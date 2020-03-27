// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
const fs = require('fs');
var socketIO = require('socket.io');var app = express();
var server = http.Server(app);
var io = socketIO(server);app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});// Starts the server.
server.listen(5000, function() {
  console.log('Starting binokl server on port 5000');
});

// global variables
var iPlayerMin = 2;
var oCardsRaw = fs.readFileSync('json/cards.json');
const aBinoklDeck = JSON.parse(oCardsRaw).concat(JSON.parse(oCardsRaw));
let aDabSize = [0, 0, 6, 6, 4];
var aGame = {};
aGame["Room"] = {
    aPlayers : [],
    iCurrentDealerID : -1,
    aDab : [],
    aCardDeck : [...aBinoklDeck],
    aReizer : [],
    iReizerIdx : -1,
    iReizVal : 140,
    aGameStats : [],
    iGameIdx : -1,
    iStecherIdx: 0,
    aStichCards: [],
    iStichCount: 0,
    open: true
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
    }, 1000);

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
                iReizVal : 140,
                aGameStats : [],
                iGameIdx : -1,
                iStecherIdx: 0,
                aStichCards: [],
                iStichCount: 0,
                open: true
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
            aGame[socket.room].aPlayers.find(x => x.id === socket.id).ready = true;
            if (aGame[socket.room].aPlayers.findIndex(x => x.ready === false) === -1
            && aGame[socket.room].aPlayers.length > 1){
                socket.emit('canstartgame'); //TODO: vielleicht liebr dem lobby führer überlassen anstatt dem letzten der ready drückt
            }
        }
    }.bind(this));

    socket.on('startgame', function() {
        // tell players it has started
        emitGameBroadcast('gamestarted');
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

    socket.on('reizval', function() {
        var oGame = aGame[socket.room];
        oGame.iReizerIdx = 1 - oGame.iReizerIdx;
        oGame.iReizVal = oGame.iReizVal + 10;
        var oReizData = {
            reizID: oGame.aReizer[oGame.iReizerIdx].id,
            reizVal: oGame.iReizVal + 10
        }
        emitGameBroadcast('reizturn', oReizData);
    });

    socket.on('reizweg', function() {
        var oGame = aGame[socket.room];
        var iPlayerIndex = oGame.aReizer.findIndex(x => x.id === socket.id);
        var iPlayerWegTeam = oGame.aReizer[iPlayerIndex].team;
        oGame.aReizer.splice(iPlayerIndex, 1);

        var iNextReizerIndex = oGame.aPlayers.findIndex(x => x.reized === false && x.team === iPlayerWegTeam);
        if (iNextReizerIndex != -1) {
            oGame.aPlayers[iNextReizerIndex].reized = true;
            oGame.aReizer.push(oGame.aPlayers[iNextReizerIndex]);
            oGame.iReizerIdx = 1;
            var oReizData = {
                reizID: oGame.aReizer[oGame.iReizerIdx].id,
                reizVal: oGame.iReizVal + 10
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
                    reizID: oGame.aReizer[oGame.iReizerIdx].id,
                    reizVal: oGame.iReizVal + 10
                }
                emitGameBroadcast('reizturn', oReizData);
            } else {
                // nein -> set game reiz, give player opp to opendab
                var oReizDone = {
                    reizID: oGame.aReizer[0].id,
                    reizVal: oGame.iReizVal
                }
                oGame.aGameStats.push(oReizDone);
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
        var iMeldePunkte = data.length //TODO: zähle gemeldetes
        var iPlayerIndex = aGame[socket.room].aPlayers.findIndex(x => x.id === socket.id);
        oGame.aPlayers[iPlayerIndex].gamestats.push({meldeVal: iMeldePunkte });
        oGame.aPlayers[iPlayerIndex].gemeldet = true;
        if (socket.id === oGame.aGameStats[oGame.iGameIdx].reizID) {
            // ander dürfen melden
            emitGameBroadcast('darfmelde', {}, true); // HERE
        } else {
            // andere gemeldet
            // haben alle gemeldet?
            var iOpenMelder = oGame.aPlayers.findIndex(x => x.gemeldet === false);
            if (iOpenMelder === -1) {
                // fertig gemeldet
                oGame.iStecherIdx = oGame.iCurrentDealerID + 1;
                if (oGame.iStecherIdx > oGame.aPlayers.length - 1) {
                    oGame.iStecherIdx = 0;
                }
                var oFirstStecherID = oGame.aPlayers[oGame.iStecherIdx].id;
                emitGameBroadcast('meldedone');
                emitGameBroadcast('darfstechen', {stecherID: oFirstStecherID, stiche: []});
            }
        }
    });

    socket.on('steche', function(data) {
        // add stich auf current stich karten
        // check if stich fertig, reset stich
        var oGame = aGame[socket.room];
        oGame.aStichCards.push({card: data, playerid: socket.id});
        if (oGame.aStichCards.length === oGame.aPlayers.length) {
            // stich fertig
            oGame.iStichCount++;
            var oStichWinner = getStichWinnerCard(oGame.aStichCards);
            var iWinnerIndex = oGame.aPlayers.findIndex(x => x.id === oStichWinner.playerid);
            oGame.iStecherIdx = iWinnerIndex;
            oGame.aPlayers[iWinnerIndex].stiche = oGame.aPlayers[iWinnerIndex].stiche.concat(oGame.aStichCards);
            if (oGame.iStichCount < oGame.iCardsPerPlayer) {
                // next stich
                var oStich = {
                    stecherID: oGame.aPlayers[iWinnerIndex].id,
                    stiche: oGame.aStichCards
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
                    if (oGame.aGameStats[oGame.iGameIdx].reizID === player.id) {
                        // TODO: dab druffrechne

                        // check if geschafft
                        var gemeldet = oGame.aPlayers[index].gamestats[oGame.iGameIdx].meldeval;
                        if (points + gemeldet >= oGame.aGameStats[oGame.iGameIdx].reizVal) {
                            oGame.aPlayers[index].points += points;
                        } else {
                            oGame.aPlayers[index].points -= oGame.aGameStats[oGame.iGameIdx].reizVal + 100;
                        }
                    } else {
                        oGame.aPlayers[index].points += points;
                    }

                });
                var oStich = {
                    stiche: oGame.aStichCards
                }
                emitGameBroadcast('darfstechen', oStich);
                // TODO: sende geschafft oder net 
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
                stiche: oGame.aStichCards
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
                aDisplayRoomPlayers.push({name: oPlayer.name, team: oPlayer.team, points: oPlayer.points, ready: oPlayer.ready});
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
        oGame.iReizVal = 140;
        oGame.iStecherIdx = 0;
        oGame.aStichCards = [];
        oGame.iStichCount = 0;
        oGame.aCardDeck = [...aBinoklDeck];
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
            reizID: oGame.aReizer[oGame.iReizerIdx].id,
            reizVal: oGame.iReizVal + 10
        }

        emitGameBroadcast('reizturn', oReizData);
    }

    function resetReady() {
        aGame[socket.room].aPlayers.forEach(x => x.ready = false);
        emitGameBroadcast('resetready');
    }

    function getStichWinnerCard(stiche) {
        //TODO check for trumpf
        //TODO spielhabender wählt trumpf
        var winnerstich = stiche[0];
        stiche.forEach(function(stich) {
            if (stich.card.suit === winnerstich.card.suit
            && stich.card.eyes > winnerstich.card.eyes) {
                winnerstich = stich;
            }
        }.bind(this));
        return winnerstich;
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


// OPEN

// MELDEN ENTGEGENNEHMEN
// ZÄHLEN

// anderes gemeldet anzeigen (dialog?)

// warum roominterval nicht gecleared wenn man room joint oder erstellt

// destroy data when lobby closed

// nachrichten an alle senden

