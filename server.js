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
let aBinoklDeck = JSON.parse(oCardsRaw).concat(JSON.parse(oCardsRaw));
let aDabSize = [0, 0, 6, 6, 4];
var aGame = {};
aGame["Room"] = {
    aPlayers : [],
    iCurrentDealerID : -1,
    aDab : [],
    aCardDeck : aBinoklDeck,
    aReizer : [],
    iReizerIdx : -1,
    iReizVal : 140,
    aGameStats : [],
    iGameIdx : 0,
    iStecherIdx: 0,
    aStichCards: [],
    iStichCount: 0
}

// Add the WebSocket handlers
io.on('connection', function(socket) {
    socket.room = "";
    // GAME ROOMS
    socket.roomInterval = setInterval(function() {
        var sOpenRooms = "";
        Object.keys(aGame).forEach(function(key,index) {
            sOpenRooms += key + " ";
        });
        io.sockets.emit('openrooms', sOpenRooms);
    }, 100);

    socket.on('disconnect', function() {
        // remove disconnected player
        if (socket.room) {
            var iPlayerIndex = aGame[socket.room].aPlayers.findIndex(x => x.id === socket.id);
            aGame[socket.room].aPlayers.splice(iPlayerIndex, 1);
            // cancel game
            if (!aGame[socket.room].aPlayers.length) {
                clearInterval(socket.playerInterval);
                delete aGame[socket.room];
                socket.room = ""
            }
        }

    }.bind(this));
    socket.on('createroom', function(data) {
        aGame[data.room] = {
            aPlayers : [],
            iCurrentDealerID : -1,
            aDab : [],
            aCardDeck : aBinoklDeck,
            aReizer : [],
            iReizerIdx : -1,
            iReizVal : 140,
            aGameStats : [],
            iGameIdx : 0,
            iStecherIdx: 0,
            aStichCards: [],
            iStichCount: 0
        }
        joinRoom(data);
    });
    socket.on('joinroom', function(data) {
        if (aGame[data.room]) {
            joinRoom(data);
        }
    }.bind(this));
    socket.on('chooseteam', function(team) {
        resetReady();
        aGame[socket.room].aPlayers.find(x => x.id === socket.id).team = team;
    });
    socket.on('ready', function() {
        // TODO reset ready when changing teams or someone joins room
        aGame[socket.room].aPlayers.find(x => x.id === socket.id).ready = true;
        if (aGame[socket.room].aPlayers.findIndex(x => x.ready === false) === -1){
            startGame();
        }
    }.bind(this));

    // GAME PLAY
    socket.on('handout', function() {
        var oGame = aGame[socket.room];
        oGame.aCardDeck = shuffle(oGame.aCardDeck);
        oGame.aDab = oGame.aCardDeck.splice(0, aDabSize[oGame.aPlayers.length]);
        oGame.iCardsPerPlayer = oGame.aPlayers.length > 2 ? (oGame.aCardDeck.length / oGame.aPlayers.length) : (oGame.aCardDeck.length / 3);
        
        oGame.aPlayers.forEach(function(oPlayer) {
            var aPlayerCards = oGame.aCardDeck.splice(0, oGame.iCardsPerPlayer);
            io.to(oPlayer.id).emit('cards', aPlayerCards);
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
        io.sockets.emit('reizturn', oReizData);
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
            io.sockets.emit('reizturn', oReizData);
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
                io.sockets.emit('reizturn', oReizData);
            } else {
                // nein -> set game reiz, give player opp to opendab
                var oReizDone = {
                    reizID: oGame.aReizer[0].id,
                    reizVal: oGame.iReizVal
                }
                oGame.aGameStats.push(oReizDone);
                // TODO: iterate gameidx once game is over
                io.sockets.emit('reizdone', oReizDone);
            }
            
         }
    });

    socket.on('dabopen', function() {
        io.sockets.emit('dabopened', aGame[socket.room].aDab);
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
            socket.broadcast.emit('darfmelde');
        } else {
            // andere gemeldet
            // haben alle gemeldet?
            var iOpenMelder = oGame.aPlayers.findIndex(x => x.gemeldet === false);
            if (iOpenMelder === -1) {
                // fertig gemeldet
                oGame.iStecherIdx = oGame.iCurrentDealerID + 1;
                var oFirstStecherID = oGame.aPlayers[oGame.iStecherIdx].id;
                io.sockets.emit('darfstechen', {stecherID: oFirstStecherID, stiche: []});
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
            console.log("stich winner: " + oGame.aPlayers[iWinnerIndex].name);
            console.log("anzahl stiche:" + oGame.iStichCount);
            console.log("anzahl maxstiche: " + oGame.iCardsPerPlayer);
            if (oGame.iStichCount < oGame.iCardsPerPlayer) {
                // next stich
                var oStich = {
                    stecherID: oGame.aPlayers[iWinnerIndex].id,
                    stiche: oGame.aStichCards
                }
                io.sockets.emit('darfstechen', oStich);
            } else {
                // runde vorbei
                // TODO zeige handout an 
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
                    console.log(player.name + " stiche " + points);
                    oGame.aPlayers[index].gamestats[oGame.iGameIdx].stichval = points;
                    if (oGame.aGameStats[oGame.iGameIdx].reizID === player.id) {
                        // TODO: dab druffrechne

                        // check if geschafft
                        var gemeldet = oGame.aPlayers[index].gamestats[oGame.iGameIdx].meldeval;
                        if (points + gemeldet >= oGame.aGameStats[oGame.iGameIdx].reizVal) {
                            oGame.aPlayers[index].points += points;
                        } else {
                            //TODO: verkackt, geh runter
                        }
                    } else {
                        oGame.aPlayers[index].points += points;
                    }

                });
                // TODO: sende geschafft oder net 
                io.sockets.emit('roundfinish');
            }
            oGame.aStichCards = [];
        } else {
            // stich läuft
            var oGame = aGame[socket.room];
            console.log("hat gelegt: " + oGame.aPlayers[oGame.iStecherIdx].name);
            oGame.iStecherIdx = oGame.iStecherIdx == oGame.aPlayers.length - 1 ? 0 : oGame.iStecherIdx + 1; 
            console.log("wird legen " + oGame.aPlayers[oGame.iStecherIdx].name);

            // call new stecher
            var oStich = {
                stecherID: oGame.aPlayers[oGame.iStecherIdx].id,
                stiche: oGame.aStichCards
            }
            io.sockets.emit('darfstechen', oStich);
        }

    }.bind(this));

    // UTILS
    function joinRoom(data) {
        socket.room = data.room;
        socket.join(socket.room);
        clearInterval(socket.roomInterval);
        socket.roomInterval = null;
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
            var sRoomPlayers = "";
            aGame[socket.room].aPlayers.forEach(function(oPlayer,index) {
                sRoomPlayers += oPlayer.name + " Team: " + oPlayer.team + " | ";
            });
            socket.emit("roomplayers", sRoomPlayers);
        }.bind(this), 1000);
    }

    function startGame() {
        //TODO close room so nobody can join
        var oGame = aGame[socket.room];
        oGame.iCurrentDealerID > oGame.aPlayers.length - 1 ? 0 : oGame.iCurrentDealerID++;
        var iDealerId = oGame.aPlayers[oGame.iCurrentDealerID].id;
        io.sockets.emit('dealer', iDealerId);
    }

    function initializeReizer() {
        var oGame = aGame[socket.room];
        //TODO correct reiz handling for more than 2 teams
        oGame.iReizerIdx = 0;
        oGame.aPlayers[oGame.iCurrentDealerID + 1].reized = true;
        oGame.aPlayers[oGame.iCurrentDealerID].reized = true;
        oGame.aReizer.push(oGame.aPlayers[oGame.iCurrentDealerID + 1]);
        if (oGame.iCurrentDealerID + 2 > oGame.aPlayers.length - 1) {
            oGame.aReizer.push(oGame.aPlayers[oGame.iCurrentDealerID]);
        } else {
            oGame.aReizer.push(oGame.aPlayers[oGame.iCurrentDealerID + 2]);
        }
        var oReizData = {
            reizID: oGame.aReizer[oGame.iReizerIdx].id,
            reizVal: oGame.iReizVal + 10
        }

        io.sockets.emit('reizturn', oReizData);
    }

    function resetReady() {
        aGame[socket.room].aPlayers.forEach(x => x.ready = false);
        io.sockets.emit('resetready');
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

    //TODO CALL THIS
    function nextRound() {
        // reset reized , gemeldet, iterate igameidx
    }
});


// OPEN

// MELDEN ENTGEGENNEHMEN
// ZÄHLEN


// STECHEN ()

// TODO
// destroy data when lobby closed


