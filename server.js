// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
const fs = require('fs');
var socketIO = require('socket.io');var app = express();
var server = http.Server(app);
var io = socketIO(server);
app.set('port', 61003);
app.use('/static', express.static(__dirname + '/static'));// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});// Starts the server.
server.listen(app.get('port'), '0.0.0.0', function() {
  console.log('Starting binokl server on port ' + app.get('port'));
});

// For uberspace, take json from absolute path
try {
    var oCardsRaw = fs.readFileSync('/var/www/virtual/binokel/html/binokl/binokel/static/json/cards.json');
} catch (error){
    var oCardsRaw = fs.readFileSync('static/json/cards.json');
}
// global variables
const aBinoklDeck = JSON.parse(oCardsRaw).concat(JSON.parse(oCardsRaw));
let aDabSize = [0, 0, 6, 6, 4];
let aSuits = ["herz", "kreuz", "bolle", "schippe"];
var aGame = {};
aGame["Room"] = {
    aPlayers : [],
    iCurrentDealerID : -1,
    aDab : [],
    aCardDeck : [...aBinoklDeck],
    aReizer : [],
    iReizerIdx : -1,
    iReizVal : 150,
    aGameStats : [],
    iGameIdx : -1,
    iStecherIdx: 0,
    aStichCards: [],
    iStichCount: 0,
    open: true,
    sTrumpf: ""
}

// Add the WebSocket handlers
io.on('connection', function(socket) {
    socket.room = "";
    // GAME ROOMS
    var roomInterval = setInterval(function() {
        const aOpenRooms = Object.keys(aGame)
            .filter(key => aGame[key].open === true)
            .reduce((obj, key) => {
                obj[key] = aGame[key];
                return obj;
            }, {});
        io.sockets.emit('openrooms', aOpenRooms);
    }, 100);

    socket.on('disconnect', function() {
        // remove disconnected player
        if (socket.room) {
            resetReady();
            var iPlayerIndex = aGame[socket.room].aPlayers.findIndex(x => x.id === socket.id);
            aGame[socket.room].aPlayers.splice(iPlayerIndex, 1);
            // cancel game
            if (!aGame[socket.room].aPlayers.length) {
                clearInterval(socket.playerInterval);
                delete aGame[socket.room];
                socket.room = ""
            } else {
                // inform players about cancel
                emitGameBroadcast("cancel");
                // TODO: playerroom interval clearen
                // TODO: intervalle ins FE legen
                clearInterval(socket.playerInterval);
            }
        }

    }.bind(this));
    socket.on('createroom', function(data) {
        if (!socket.room && !aGame[data.room]) {
            aGame[data.room] = {
                aPlayers : [],
                iCurrentDealerID : -1,
                aDab : [],
                aCardDeck : [...aBinoklDeck],
                aReizer : [],
                iReizerIdx : -1,
                iReizVal : 150,
                aGameStats : [],
                iGameIdx : -1,
                iStecherIdx: 0,
                aStichCards: [],
                iStichCount: 0,
                open: true,
                sTrumpf: ""
            }
            clearInterval(roomInterval);
            joinRoom(data);
        }
    });
    socket.on('joinroom', function(data) {
        if (!socket.room && aGame[data.room]) {
            clearInterval(roomInterval);
            joinRoom(data);
        }
    });
    socket.on('chooseteam', function(team) {
        if (socket.room) {
            resetReady();
            aGame[socket.room].aPlayers.find(x => x.id === socket.id).team = team;
        }
    });
    socket.on('ready', function() {
        if (socket.room) {
            oGame = aGame[socket.room];
            oGame.aPlayers.find(x => x.id === socket.id).ready = true;
            if (oGame.aPlayers.findIndex(x => x.ready === false) === -1
            && oGame.aPlayers.length > 1
            && oGame.aPlayers.length < 5) {
                if (oGame.aPlayers.length === 4) {
                    //check teams
                    var teamcount = oGame.aPlayers.filter((x) => x.team == 1).length;
                    if (teamcount === 2) {
                        io.to(oGame.aPlayers[0].id).emit('canstartgame');
                    }
                } else {
                    io.to(oGame.aPlayers[0].id).emit('canstartgame');
                }
            }
        }
    }.bind(this));

    socket.on('startgame', function() {
        var oGame = aGame[socket.room];
        // check if teams are applied although they shouldnt
        if (oGame.aPlayers.length < 4) {
            oGame.aPlayers.forEach(function(player) {
                player.team = 1;
            }.bind(this));
        }
        // tell players it has started
        if (oGame.aPlayers.length === 4) {
            var sortedPlayers = [];
            var firstTeam = oGame.aPlayers[0].team;
            sortedPlayers.push(oGame.aPlayers[0]);
            var secondTeamPlayer = oGame.aPlayers.findIndex(x => x.team != firstTeam);
            sortedPlayers.push(oGame.aPlayers[secondTeamPlayer]);
            var firstTeamPlayer = oGame.aPlayers.findIndex(x => x.team == firstTeam && x.id != sortedPlayers[0].id);
            sortedPlayers.push(oGame.aPlayers[firstTeamPlayer]);
            secondTeamPlayer = oGame.aPlayers.findIndex(x => x.team != firstTeam && x.id != sortedPlayers[1].id);
            sortedPlayers.push(oGame.aPlayers[secondTeamPlayer]);

            oGame.aPlayers = sortedPlayers;
        }
        emitGameBroadcast('gamestarted', oGame.aPlayers);
        startGame();
    });

    // GAME PLAY
    socket.on('handout', function() {
        var oGame = aGame[socket.room];
        oGame.aCardDeck = shuffle(oGame.aCardDeck);
        oGame.aDab = oGame.aCardDeck.splice(0, aDabSize[oGame.aPlayers.length]);
        oGame.iCardsPerPlayer = oGame.aPlayers.length > 2 ? (oGame.aCardDeck.length / oGame.aPlayers.length) : (oGame.aCardDeck.length / 3);
        
        oGame.aPlayers.forEach(function(oPlayer) {
            var aPlayerCards = oGame.aCardDeck.splice(0, oGame.iCardsPerPlayer);
            io.to(oPlayer.id).emit('cards', {cards: aPlayerCards, dab: oGame.aDab});
        }.bind(this));
        initializeReizer();
    });

    socket.on('reizval', function(val) {
        var oGame = aGame[socket.room];
        oGame.iReizerIdx = 1 - oGame.iReizerIdx;
        oGame.iReizVal = val;
        var oReizData = {
            reizIDnext: oGame.aReizer[oGame.iReizerIdx].id,
            reizVal: val,
            reizIDlast: oGame.aReizer[1 - oGame.iReizerIdx].id 
        }
        emitGameBroadcast('reizturn', oReizData);
    });

    socket.on('reizweg', function() {
        var oGame = aGame[socket.room];
        var iPlayerIndex = oGame.aReizer.findIndex(x => x.id === socket.id);
        emitGameBroadcast('weggegangen', socket.id);

        var iPlayerWegTeam = oGame.aReizer[iPlayerIndex].team;
        oGame.aReizer.splice(iPlayerIndex, 1);

        var iNextReizerIndex = oGame.aPlayers.findIndex(x => x.reized === false && x.team === iPlayerWegTeam);
        if (iNextReizerIndex != -1) {
            oGame.aPlayers[iNextReizerIndex].reized = true;
            oGame.aReizer.push(oGame.aPlayers[iNextReizerIndex]);
            oGame.iReizerIdx = 1;
            var oReizData = {
                //reizIDlast: socket.id,
                reizIDnext: oGame.aReizer[oGame.iReizerIdx].id,
                reizVal: oGame.iReizVal
            }
            emitGameBroadcast('reizturn', oReizData);
        } else {
            // check obs im selbsen team noch jemand gibt der nicht greized hat
            var iNextReizerIndex = oGame.aPlayers.findIndex(x => x.reized === false);
            if (iNextReizerIndex != -1) {
                oGame.aPlayers[iNextReizerIndex].reized = true;
                oGame.aReizer.push(oGame.aPlayers[iNextReizerIndex]);
                oGame.iReizerIdx = 1;
                var oReizData = {
                    reizIDnext: oGame.aReizer[oGame.iReizerIdx].id,
                    reizVal: oGame.iReizVal,
                    //reizIDlast: socket.id
                }
                emitGameBroadcast('reizturn', oReizData);
            } else {
                // nein -> set game reiz, give player opp to opendab
                var oReizDone = {
                    reizID: oGame.aReizer[0].id,
                    reizVal: oGame.iReizVal
                }
                oGame.aGameStats.push(oReizDone);
                oGame.aPlayers.forEach(function(player) {
                    if (player.id == oGame.aReizer[0].id) {
                        player.gamestats.push({reiz : oGame.iReizVal});
                    } else {
                        player.gamestats.push({reiz : 0});
                    }
                }.bind(this));
                sendGameStats();
                emitGameBroadcast('reizdone', oReizDone);
            }
            
         }
    }.bind(this));

    socket.on('dabopen', function(i) {
        emitGameBroadcast('dabopened', {idx: i, card: aGame[socket.room].aDab[i]});
    });
    
    socket.on('melde', function(data) {
        // save gemeldetes
        var oGame = aGame[socket.room];
        if (socket.id === oGame.aGameStats[oGame.iGameIdx].reizID) {
            oGame.sTrumpf = data.trumpf;
            var iSpielhabenderIdx = oGame.aPlayers.findIndex(x => x.id === socket.id);
            oGame.aPlayers[iSpielhabenderIdx].stiche = oGame.aPlayers[iSpielhabenderIdx].stiche.concat(data.gedruckt);
        }
        var iPlayerIndex = aGame[socket.room].aPlayers.findIndex(x => x.id === socket.id);
        var oMeldung = countMeldung(data.gemeldet);
        oMeldung.name = oGame.aPlayers[iPlayerIndex].name;
        oMeldung.trumpf = data.trumpf ? data.trumpf : "";
        emitGameBroadcast('gemeldet', oMeldung);

        oGame.aPlayers[iPlayerIndex].gamestats[oGame.iGameIdx].meldung = oMeldung;
        oGame.aPlayers[iPlayerIndex].gemeldet = true;
        // haben alle gemeldet?
        var iOpenMelder = oGame.aPlayers.findIndex(x => x.gemeldet === false);
        if (iOpenMelder != -1) {
            // only to next melder
            var iNextMelderIdx = iPlayerIndex + 1;
            iNextMelderIdx = iNextMelderIdx == oGame.aPlayers.length ? 0 : iNextMelderIdx;
            var iNextMelderPlayer = oGame.aPlayers[iNextMelderIdx];
            emitGameBroadcast("darfmelde", {id: iNextMelderPlayer.id});
            // todo: team und dann anderes team
        } else {
            // fertig gemeldet
            oGame.iStecherIdx = oGame.iCurrentDealerID + 1;
            if (oGame.iStecherIdx > oGame.aPlayers.length - 1) {
                oGame.iStecherIdx = 0;
            }
            var oFirstStecherID = oGame.aPlayers[oGame.iStecherIdx].id;
            var aMeldungen = [];
            oGame.aPlayers.forEach(function(player) {
                aMeldungen.push({
                    meldungen: player.gamestats[oGame.iGameIdx].meldung.meldungen,
                    punkte: player.gamestats[oGame.iGameIdx].meldung.punkte,
                    name: player.name
                });
            });
            sendGameStats();
            emitGameBroadcast('meldedone', aMeldungen);
            emitGameBroadcast('darfstechen', {stecherID: oFirstStecherID, stiche: []});
        }
    });

    socket.on('steche', function(data) {
        // add stich auf current stich karten
        // check if stich fertig, reset stich
        var oGame = aGame[socket.room];
        oGame.aStichCards.push({card: data, playerid: socket.id});
        var oStichWinner = getStichWinnerCard(oGame.aStichCards);
        if (oGame.aStichCards.length === oGame.aPlayers.length) {
            // stich fertig
            oGame.iStichCount++;
            var iWinnerIndex = oGame.aPlayers.findIndex(x => x.id === oStichWinner.playerid);
            oGame.iStecherIdx = iWinnerIndex;
            oGame.aPlayers[iWinnerIndex].stiche = oGame.aPlayers[iWinnerIndex].stiche.concat(oGame.aStichCards);
            if (oGame.iStichCount < oGame.iCardsPerPlayer) {
                // next stich
                var oStich = {
                    stecherID: oGame.aPlayers[iWinnerIndex].id,
                    stiche: oGame.aStichCards,
                    stichwinner: oStichWinner,
                    newstich: true
                }
                emitGameBroadcast('darfstechen', oStich);
            } else {
                // runde vorbei
                oGame.iStichCount = 0;
                oGame.aPlayers.forEach(function(player, index) {
                    var points = 0;
                    player.stiche.forEach(function(stich) {
                        points += stich.card.eyes;
                    })
                    if (iWinnerIndex = index) {
                        points += 10;
                    }
                    points = Math.round(points / 10) * 10;
                    oGame.aPlayers[index].gamestats[oGame.iGameIdx].stichval = points;
                    var gemeldet = oGame.aPlayers[index].gamestats[oGame.iGameIdx].meldung.punkte;
                    if (oGame.aGameStats[oGame.iGameIdx].reizID === player.id) {
                        // check if geschafft
                        var gereizt = oGame.aPlayers[index].gamestats[oGame.iGameIdx].reiz;
                        if (points + gemeldet >= gereizt) {
                            oGame.aPlayers[index].points += points + gemeldet;
                        } else {
                            oGame.aPlayers[index].points -= gereizt + 100;
                        }
                    } else {
                        if (points > 0) {
                            oGame.aPlayers[index].points += points + gemeldet;
                        }
                    }

                });
                var oStich = {
                    stiche: oGame.aStichCards,
                    newstich: true
                }
                emitGameBroadcast('darfstechen', oStich);
                // TODO: rundenende, sende stats / geschafft oder nit?
                sendGameStats(true);
                nextRound();
            }
            oGame.aStichCards = [];
        } else {
            // stich läuft
            var oGame = aGame[socket.room];
            oGame.iStecherIdx = oGame.iStecherIdx == oGame.aPlayers.length - 1 ? 0 : oGame.iStecherIdx + 1; 
            // call new stecher
            var oStich = {
                stecherID: oGame.aPlayers[oGame.iStecherIdx].id,
                stiche: oGame.aStichCards,
                stichwinner: oStichWinner,
                newstich: false
            }
            emitGameBroadcast('darfstechen', oStich);
        }

    }.bind(this));

    // UTILS
    function emitGameBroadcast(message, data, exceptsender) {
        aGame[socket.room].aPlayers.forEach(function(player) {
            if (!exceptsender || socket.id != player.id) {
                io.to(player.id).emit(message, data);
            }
        }.bind(this));
    }

    function joinRoom(data) {
        socket.room = data.room;
        socket.join(socket.room);
        resetReady();
        aGame[socket.room].aPlayers[aGame[socket.room].aPlayers.length] = {
            id: socket.id,
            name: data.name,
            team: 1,
            cards: {},
            ready: false,
            reized: false,
            gemeldet: false,
            gamestats: [],
            stiche: [],
            points: 0
        }
        socket.playerInterval = setInterval(function() {
            var aDisplayRoomPlayers = [];
            aGame[socket.room].aPlayers.forEach(function(oPlayer,index) {
                aDisplayRoomPlayers.push({name: oPlayer.name, team: oPlayer.team, points: oPlayer.points, ready: oPlayer.ready, id: oPlayer.id});
            });
            socket.emit("roomplayers", aDisplayRoomPlayers);
        }.bind(this), 2000);
    }

    function startGame() {
        aGame[socket.room].open = false;
        nextRound();
    }

    function nextRound() {
        // reset players
        var oGame = aGame[socket.room];
        oGame.aPlayers.forEach(function(player, index) {
            oGame.aPlayers[index].reized = false;
            oGame.aPlayers[index].gemeldet = false;
            oGame.aPlayers[index].stiche = [];
        }.bind(this));

        //reset game
        oGame.iGameIdx++;
        oGame.aReizer = [];
        oGame.iReizerIdx = -1;
        oGame.iReizVal = 150;
        oGame.iStecherIdx = 0;
        oGame.aStichCards = [];
        oGame.iStichCount = 0;
        oGame.aCardDeck = [...aBinoklDeck];
        oGame.sTrumpf = "";
        oGame.aDab = [];

        oGame.iCurrentDealerID = oGame.iCurrentDealerID + 1 > oGame.aPlayers.length - 1 ? 0 : oGame.iCurrentDealerID + 1;

        var iDealerId = oGame.aPlayers[oGame.iCurrentDealerID].id;
        emitGameBroadcast('dealer', iDealerId);
    }

    function initializeReizer() {
        var oGame = aGame[socket.room];
        //TODO correct reiz handling for more than one teams
        oGame.iReizerIdx = 0;
        var firstReizerId = oGame.iCurrentDealerID + 1;
        if (firstReizerId > oGame.aPlayers.length - 1) {
            firstReizerId = 0;
        }
        var secondReizerId = firstReizerId + 1;
        if (secondReizerId > oGame.aPlayers.length - 1) {
            secondReizerId = 0;
        }
        oGame.aPlayers[firstReizerId].reized = true;
        oGame.aPlayers[secondReizerId].reized = true;
        oGame.aReizer.push(oGame.aPlayers[firstReizerId]);
        oGame.aReizer.push(oGame.aPlayers[secondReizerId]);
        var oReizData = {
            reizIDlast: null,
            reizVal: oGame.iReizVal,
            reizIDnext: oGame.aReizer[oGame.iReizerIdx].id,
        }

        emitGameBroadcast('reizturn', oReizData);
    }

    function resetReady() {
        aGame[socket.room].aPlayers.forEach(x => x.ready = false);
        emitGameBroadcast('resetready');
    }

    function countMeldung(cards) {
        var oGame = aGame[socket.room];
        var aCounts = _createCounts(cards);
        
        var aMeldung = [];
        var iPunkte = 0;

        var aFamilies = findFamily();
        aFamilies.forEach(function(family) {
            if (family.count == 2) {
                aMeldung.push({
                    combi:"doppeltefamilie",
                    suit: family.suit,
                    points: 1500,
                    cards: [
                        {suit: family.suit, value: 'A'},
                        {suit: family.suit, value: 'A'},
                        {suit: family.suit, value: '10'},
                        {suit: family.suit, value: '10'},
                        {suit: family.suit, value: 'K'},
                        {suit: family.suit, value: 'K'},
                        {suit: family.suit, value: 'O'},
                        {suit: family.suit, value: 'O'},
                        {suit: family.suit, value: 'U'},
                        {suit: family.suit, value: 'U'},
                    ]
                });
            } else {
                var points = family.suit == oGame.sTrumpf ? 150 : 100;
                aMeldung.push({
                    combi:"familie",
                    suit: family.suit,
                    points: points,
                    cards: [
                        {suit: family.suit, value: 'A'},
                        {suit: family.suit, value: '10'},
                        {suit: family.suit, value: 'K'},
                        {suit: family.suit, value: 'O'},
                        {suit: family.suit, value: 'U'},
                    ]
                });
            }
        });

        var aPaare = findPaar();
        if (aPaare.length === 4) {
            aMeldung.push({
                combi: "rundlauf",
                points: 240,
                cards: [
                    {suit: "schippe", value: 'K'},
                    {suit: "schippe", value: 'O'},
                    {suit: "kreuz", value: 'K'},
                    {suit: "kreuz", value: 'O'},
                    {suit: "bolle", value: 'K'},
                    {suit: "bolle", value: 'O'},
                    {suit: "herz", value: 'K'},
                    {suit: "herz", value: 'O'},
                ]
            });
        } else {
            aPaare.forEach(function(paar) {
                var bIsInFamily, bIsDoubleFamily = false;
                aMeldung.forEach(function(family) {
                    if (family.suit == paar.suit) {
                        if (family.count == 2) {
                            bIsDoubleFamily = true;
                        }
                        bIsInFamily = true;
                    }
                })
                var points = paar.suit == oGame.sTrumpf ? 40 : 20;
                if (paar.count == 1 && !bIsInFamily|| bIsInFamily && paar.count == 2 && !bIsDoubleFamily) {
                    aMeldung.push({combi:"paar", suit: paar.suit, points: points, cards: [{suit: paar.suit, value:"K"}, {suit:paar.suit, value:"O"}]});
                } else if (paar.count == 2 && !bIsInFamily) {
                    aMeldung.push({combi:"paar", suit: paar.suit, points: points, cards: [{suit: paar.suit, value:"K"}, {suit:paar.suit, value:"O"}]});
                    aMeldung.push({combi:"paar", suit: paar.suit, points: points, cards: [{suit: paar.suit, value:"K"}, {suit:paar.suit, value:"O"}]});
                }
            });
        }
        
        var iBinokel = findBinokel();
        if (iBinokel === 1) {
            aMeldung.push({combi: "binokel", points: 40, cards: [{suit: "schippe", value:"O"}, {suit: "bolle", value:"U"}]});
        } else if (iBinokel === 2) {
            aMeldung.push({combi: "doppelterbinokel", points: 300, cards: [{suit: "schippe", value:"O"}, {suit: "bolle", value:"U"}, {suit: "schippe", value:"O"}, {suit: "bolle", value:"U"}]});
        }

        var aGleiche = findGleiche();
        aGleiche.forEach(function(gleiche) {
            if (gleiche.count > 1) {
                aMeldung.push({
                    combi: "8gleiche",
                    points: 1000,
                    cards: [
                        {suit: "schippe", value: gleiche.bild},
                        {suit: "schippe", value: gleiche.bild},
                        {suit: "kreuz", value: gleiche.bild},
                        {suit: "kreuz", value: gleiche.bild},
                        {suit: "bolle", value: gleiche.bild},
                        {suit: "bolle", value: gleiche.bild},
                        {suit: "herz", value: gleiche.bild},
                        {suit: "herz", value: gleiche.bild},
                    ]
                });
            } else {
                var points = 0;
                switch(gleiche.bild) {
                    case "A":
                        points += 100;
                        break;
                    case "K":
                        points += 80;
                        break;
                    case "O":
                        points += 60;
                        break;
                    case "U":
                        points += 40;
                        break;
                }
                aMeldung.push({
                    combi: "4gleiche",
                    points: points,
                    cards: [
                        {suit: "schippe", value: gleiche.bild},
                        {suit: "kreuz", value: gleiche.bild},
                        {suit: "bolle", value: gleiche.bild},
                        {suit: "herz", value: gleiche.bild},
                    ]
                });
            }
        });

        var iDiss = aCounts[oGame.sTrumpf + "7"];
        if (iDiss) {
            aMeldung.push({combi: "diss", suit: oGame.sTrumpf, points: 10, cards: [{suit: oGame.sTrumpf, value: "7"}]});
            if (iDiss > 1) {
                aMeldung.push({combi: "diss", suit: oGame.sTrumpf, points: 10, cards: [{suit: oGame.sTrumpf, value: "7"}]});
            }
        }

        aMeldung.forEach(function(meldung) {
            iPunkte += meldung.points;
        })

        return {meldungen: aMeldung, punkte: iPunkte};

        function findFamily() {
            aFoundFamily = [];
            aSuits.forEach(function(suit) {
                
                var one = aCounts[suit+"A"] > 0 &&
                aCounts[suit+"10"] > 0 &&
                aCounts[suit+"K"] > 0 &&
                aCounts[suit+"O"] > 0 &&
                aCounts[suit+"U"] > 0;

                var two = aCounts[suit+"A"] > 1 &&
                aCounts[suit+"10"] > 1 &&
                aCounts[suit+"K"] > 1 &&
                aCounts[suit+"O"] > 1 &&
                aCounts[suit+"U"] > 1;

                if (two) {
                    aFoundFamily.push({suit: suit, count: 2})
                } else if (one) {
                    aFoundFamily.push({suit: suit, count: 1});
                }
            });
            return aFoundFamily;
        } 

       function findPaar() {
            aFoundPaar = [];
            aSuits.forEach(function(suit) {
                var one = aCounts[suit+"K"] > 0 &&
                aCounts[suit+"O"] > 0;

                var two = aCounts[suit+"K"] > 1 &&
                aCounts[suit+"O"] > 1;

                if (two) {
                    aFoundPaar.push({suit: suit, count: 2});
                } else if (one) {
                    aFoundPaar.push({suit: suit, count: 1});
                }
            });
            return aFoundPaar;
        } 

        function findGleiche() {
            var aBilder = ["A", "10", "K", "O", "U", "7"];
            var aFoundGleiche = [];
            aBilder.forEach(function(bild) {
                var one = aCounts["herz" +  bild] > 0 &&
                    aCounts["bolle" + bild] > 0 &&
                    aCounts["schippe" + bild] > 0 &&
                    aCounts["kreuz" + bild] > 0;
                
                var two = aCounts["herz" +  bild] > 1 &&
                    aCounts["bolle" + bild] > 1 &&
                    aCounts["schippe" + bild] > 1 &&
                    aCounts["kreuz" + bild] > 1;

                if (two) {
                    aFoundGleiche.push({bild: bild, count: 2})
                } else if (one && bild != "7" && bild != "10") {
                    aFoundGleiche.push({bild: bild, count: 1});
                }  
            });
            return aFoundGleiche;
        }

        function findBinokel() {
            var one = aCounts["schippeO"] > 0 &&
                aCounts["bolleU"] > 0;
            var two = aCounts["schippeO"] > 1 &&
                aCounts["bolleU"] > 1;
            if (two) {
                return 2;
            } else if (one) {
                return 1;
            }
        }

        function _createCounts(arr) {
            var counts = {};
            for (var i = 0; i < arr.length; i++) {
                var element = arr[i];
                var val = element.suit + element.value;
                counts[val] = counts[val] ? counts[val] + 1 : 1;
            }
            return counts;
        }
    }

    function getStichWinnerCard(stiche) {
        var winnerstich = stiche[0];
        stiche.forEach(function(stich) {
            if (stich.card.suit === winnerstich.card.suit) {
                if (stich.card.eyes > winnerstich.card.eyes) {
                    winnerstich = stich;   
                }
            } else if (stich.card.suit === aGame[socket.room].sTrumpf) {
                winnerstich = stich;
            }
        });
        return winnerstich;
    }

    function sendGameStats(bRoundend) {
        var oGame = aGame[socket.room];
        var oCurrentGameStats = {};
        oCurrentGameStats.stats = {};
        oCurrentGameStats.points = {};
        oCurrentGameStats.roundEnd = bRoundend;
        oGame.aPlayers.forEach(function(player) {
            oCurrentGameStats.stats[player.name] = [];
            player.gamestats.forEach(function(gamestat) {
                oCurrentGameStats.stats[player.name].push({
                    val: gamestat.reiz, 
                    type: "Reiz"
                });
                oCurrentGameStats.stats[player.name].push({
                    val: gamestat.meldung ? gamestat.meldung.punkte : 0,
                    type: "Meldung"
                });
                oCurrentGameStats.stats[player.name].push({
                    val: gamestat.stichval,
                    type: "Stich"
                });
            }.bind(this));
            oCurrentGameStats.points[player.name] = player.points;
        }.bind(this));
        
        emitGameBroadcast('gamestats', oCurrentGameStats);
    }

    function shuffle(array) {
        var i = 0
          , j = 0
          , temp = null
        for (i = array.length - 1; i > 0; i -= 1) {
          j = Math.floor(Math.random() * (i + 1))
          temp = array[i]
          array[i] = array[j]
          array[j] = temp
        }
        return array;
    }
});


// TODO

// meldungen vom team 1 anzeigen, dann team 2 melden

// gedrucktes zählen (drin?)

// es wird grade paar gezählt das schon in familie drin is

// was wenn "nab" gedrückt wird, nicht gespielt werden will

// warum roominterval nicht gecleared wenn man room joint oder erstellt

// destroy data when lobby closed

// nachrichten an alle senden

// beim melden kann der nicht spielhabende auch den dab anklicken zum melden lool

// WICHTIG:

// punktestand übersichtlicher
// richtig rechnen

// melden besser anzeigen

// direkt "nab" drücken können wenn mans nicht schafft

// dealer anzeigen
// wer kommt raus


// bei rundlauf nicht K und O als 4 gleiche zählen