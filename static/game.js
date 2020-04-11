
// GLOBAL VARIABLES
var socket = io();
var myName = "";
var myCards = [];
var myStechTurn = false;
var myDabTurn = false;
var myTrumpf = "";
var theTrumpf = "";
var openRooms = [];
var myRoom = "";
var aDab = [];
var myMeldeTurn = false;
var myGame = false;
var theStichWinner = {};
var gameStarted = false;
var thePlayers = [];

// SOCKET HANDLERS
socket.on('message', function(data) {
  console.log(data);
});

socket.on('dealer', function(data) {
    if (data === socket.id) {
        showElement("idButtonHandOut", "block");
    }
})

socket.on('cards', function(data) {
    myGame = false;
    myTrumpf = "";
    theTrumpf = "";
    addToMyCards(data.cards);
    // dab
    aDab = data.dab;
    var oDivDab = document.getElementById("idDivDab");
    oDivDab.innerHTML = "";
    for (var i in data.dab) {
        var oCardButton = document.createElement("button");
        oCardButton.id = "idDabCard" + i;
        oCardButton.idx = i;
        oCardButton.className = "card dabcard";
        oCardButton.onclick = onClickCard.bind(oCardButton);
        oDivDab.appendChild(oCardButton); 
    }
    showElement("idDivDab");

})

socket.on('dabopened', function(data) {
    var oCardButton = document.getElementById("idDabCard" + data.idx);
    oCardButton.open = true;
    oCardButton.style.backgroundImage = "url(/static/img/" + data.card.suit + ".png)";
    oCardButton.textContent = data.card.value;
    oCardButton.value = data.card.value;
    oCardButton.suit = data.card.suit;
    oCardButton.eyes = data.card.eyes;
})

socket.on('openrooms', function(data) {
    //document.getElementById("idLabelRooms").innerHTML = JSON.stringify(Object.keys(data));
    var oDivRooms = document.getElementById("idDivOpenRooms");

    var schondrin = Object.keys(data).filter(x => Object.keys(openRooms).includes(x));
    var neu = Object.keys(data).filter(x => !Object.keys(openRooms).includes(x));
    var weg = Object.keys(openRooms).filter(x => !Object.keys(data).includes(x));

    schondrin.forEach(function(room) {
        // nur players updaten
        var player = document.getElementById("idPlayers" + room);
        player.innerHTML = data[room].aPlayers.length;
    }.bind(this));

    neu.forEach(function(room) {
        // erstllen mit name und 
        var item = document.createElement("div");
        item.setAttribute("id", "idDiv" + room);
        var roomname = document.createElement("span");
        roomname.innerHTML = room;
        var players = document.createElement("span");
        players.innerHTML = data[room].aPlayers.length;
        players.setAttribute("id", "idPlayers" + room);
        var join = document.createElement("button");
        join.textContent = "JOIN";
        join.value = room;
        join.onclick = onJoinRoom.bind(join);
        item.appendChild(roomname);
        item.appendChild(players);
        item.appendChild(join);
        oDivRooms.appendChild(item);
        console.log();
    }.bind(this));

    weg.forEach(function(room) {
        // room löschen
    }.bind(this));
    openRooms = data;
})

socket.on('roomplayers', function(data) {
    if (!gameStarted) {
        var oDivPlayers = document.getElementById("idDivPlayerLobby");
        oDivPlayers.innerHTML = "";
        data.forEach(function(player) {
            buildLobbyPlayer(oDivPlayers, player, data.length > 3);
        }.bind(this));
    }
})

socket.on('resetready', function() {
    hideElement("idButtonStartGame");
    showElement("idButtonReady", "block");
})

socket.on('canstartgame', function() {
    showElement("idButtonStartGame");
})

socket.on('gamestarted', function(data) {
    gameStarted = true;
    thePlayers = data;
    updatePlayer(data);

    hideElement("idDivLobby");
    // show gameplay
    showElement('idDivGameplay');
})

socket.on('cancel', function() {
    hideElement("idDivGameplay");
    // show gameplay
    // TODO reset divgameplay so after new join everything is fine
    showElement('idDivLobby');
})

socket.on('reizturn', function(data) {
    //TODO: show reizvalue
    if (data.reizIDlast) {
        showReizValue(data);
    }
    if (data.reizIDnext === socket.id) {
        // du reizst
        showElement("idDivReiz");
        document.getElementById("idInputReiz").value = data.reizVal;
    } 
})

socket.on('reizdone', function(data) {
    if (data.reizID === socket.id) {
        // du hast es game
        myDabTurn = true;
        showElement("idButtonDabOpen", "block");
    } else {
        // jemand hat es game
        console.log("jemand hat reiz mit " + data.reizVal);
    } 
})

socket.on('darfmelde', function() {
    myMeldeTurn = true;
    showElement("idButtonMelden", "block");
})

socket.on('gemeldet', function(data) {
    if (data.trumpf) {
        theTrumpf = data.trumpf;
    }
    console.log("Player gemeldet: " + data);
})

socket.on('meldedone', function(data) {
    hideElement("idDivDab");
    showElement("idDivMeldungen");
    console.log(data);
    showElement("idDivStich");
})

socket.on('darfstechen', function(data) {
    // show new card
    var oDivStich = document.getElementById('idDivStich');
    if (data.stiche.length) {
        oDivStich.innerHTML = "";
        data.stiche.forEach(function(stich) {
            var oCardButton = document.createElement("button");
            oCardButton.textContent = stich.card.value;
            oCardButton.suit = stich.card.suit;
            oCardButton.value = stich.card.value;
            oCardButton.eyes = stich.card.eyes;
            oCardButton.style.backgroundImage = "url(/static/img/" + stich.card.suit + ".png)";
            oCardButton.className = "card stichcard";
            oDivStich.appendChild(oCardButton);
        })
    }
    if (data.newstich) {
        theStichWinner = {};
    } else {
        theStichWinner = data.stichwinner;
    }
    // check if du bist dran
    if (data.stecherID === socket.id) {
        //TODO: zeige dass du dran bist
        console.log("ich darf stechen");
        myStechTurn = true;
    }
})

// BUTTON HANDLERS
function onEnterName() {
    myName = document.getElementById("idInputName").value;
    removeElement("idDivName");
    showElement("idDivRooms");
}
function onCreateRoom() {
    var sRoomname = document.getElementById("idInputCreateGameRoom").value;
    if (sRoomname) {
        socket.emit('createroom', {room: sRoomname, name: myName});
        myRoom = sRoomname;
        document.getElementById("idLabelRoomname").innerHTML = sRoomname;
        removeElement("idDivRooms");
        showElement("idDivLobby");
    }
}

function onJoinRoom(e) {
    var sRoomname = e.srcElement.value;
    socket.emit('joinroom', {room: sRoomname, name: myName})
    removeElement("idDivRooms")
    myRoom = sRoomname;
    document.getElementById("idLabelRoomname").innerHTML = sRoomname;
    showElement("idDivLobby");
}

function chooseTeam(radio) {
    socket.emit('chooseteam', radio.id);
}

function onClickReady() {
    hideElement("idButtonReady");
    socket.emit('ready');
}

function onStartGame() {
    socket.emit('startgame');
    // close lobby view
}

function onHandOut() {
    hideElement("idButtonHandOut");
    socket.emit('handout');
}

function onReiz() {
    // TODO check ob reiz höher is als bisherigers
    var reizval = document.getElementById("idInputReiz").value;
    hideElement("idDivReiz");
    socket.emit('reizval', reizval);
}

function onWeg() {
    hideElement("idDivReiz");
    socket.emit('reizweg');
}

function onMelden() {
    hideElement("idButtonMelden");
    hideElement("idDivTrumpf");
    myMeldeTurn = false;

    var aGemeldet = [];
    $(".cardmeldestatemelden").each(function() {
        aGemeldet.push({
            value: this.value,
            suit: this.suit
        });
    });
    var aGedruckt = [];
    $(".cardmeldestatedrucke").each(function() {
        aGedruckt.push({
            value: this.value,
            suit: this.suit
        });
        this.parentNode.removeChild(this);
    });
    
    var oMeldung = {
        gemeldet: aGemeldet,
        gedruckt: aGedruckt,
        trumpf: myTrumpf
    }
    socket.emit('melde', oMeldung);
}

function onChooseTrumpf(srcElement) {
    var trumpfbutton = ["idButtonTrumpfSchippe", "idButtonTrumpfKreuz", "idButtonTrumpfHerz", "idButtonTrumpfBolle"];
    for (var i in trumpfbutton) {
        var button = document.getElementById(trumpfbutton[i]);
        if (trumpfbutton[i] != srcElement.id) {
            button.classList.remove("active");
        } else {
            button.classList.add("active");
            myTrumpf = button.value;
        }
    }
    if ($(".cardmeldestatedrucke").length === aDab.length && myTrumpf) {
        // genug gedruckt
        document.getElementById("idButtonMelden").disabled = false;
    }
}

function onCloseMeldungen() {
    hideElement("idDivMeldungen");
}

function onClickCard(e) {
    // TODO: when is my turn, when wird gestochen/sortiert
    if (myStechTurn) {
            var oDivCards = document.getElementById("idDivCards");
            var oStichCards = document.getElementById("idDivStich");
            var isValid = false;
            //leg karte
            //hab ich karte suit oder trumpf
            if (oStichCards.childElementCount == thePlayers.length || !oStichCards.hasChildNodes() ) {
                socket.emit('steche', {suit: e.srcElement.suit, value: e.srcElement.value, eyes: e.srcElement.eyes});
                var cardIdx = myCards.findIndex(x => x.suit == e.srcElement.suit && x.eyes == e.srcElement.eyes);
                myCards.splice(cardIdx, 1);
                oDivCards.removeChild(e.srcElement);
                myStechTurn = false;
            } else {
                var firstCard = oStichCards.childNodes[0];
                var iTrumpfIdx = myCards.findIndex(x => x.suit === theTrumpf);
                var iSuitIdx = myCards.findIndex(x => x.suit === firstCard.suit);
                if (iSuitIdx != -1) {
                    if (firstCard.suit != theTrumpf) {
                        if (theStichWinner.card.suit == theTrumpf) {
                            // muss nicht stechen
                            // muss selbe farbe wie start
                            if (e.srcElement.suit == firstCard.suit) {
                                isValid = true;
                            }
                        } else {
                            // muss stichwinner stechen
                            var iCanIStech = myCards.findIndex(x => x.eyes > theStichWinner.card.eyes && x.suit == theStichWinner.card.suit);
                            if (iCanIStech != -1) {
                                if (e.srcElement.suit == firstCard.suit && e.srcElement.eyes > theStichWinner.card.eyes) {
                                    isValid = true;
                                }
                            } else {
                                if (e.srcElement.suit == firstCard.suit) {
                                    isValid = true;
                                }
                            }
                            
                        }
                    } else {
                         // muss stechen
                         var iCanIStech = myCards.findIndex(x => x.eyes > theStichWinner.card.eyes && x.suit == firstCard.suit);
                         if (iCanIStech != -1) {
                             if (e.srcElement.suit == firstCard.suit && e.srcElement.eyes > theStichWinner.card.eyes) {
                                 isValid = true;
                             }
                         } else {
                             if (e.srcElement.suit == firstCard.suit) {
                                 isValid = true;
                             }
                         }
                    }
                } else if (iTrumpfIdx != -1) {
                    // hat farbe nicht aber hat trumpf
                    // liegt schon trumpf?
                    if (theStichWinner.card.suit == theTrumpf) {
                        // muss stichwinner stechen wenns geht
                        var iCanIStech = myCards.findIndex(x => x.eyes > theStichWinner.card.eyes && x.suit == theStichWinner.card.suit);
                        if (iCanIStech != -1) {
                            if (e.srcElement.suit == theTrumpf && e.srcElement.eyes > theStichWinner.card.eyes) {
                                isValid = true;
                            }
                        } else {
                            // kann irgendein trumpf
                            if (e.srcElement.suit == theTrumpf) {
                                isValid = true;
                            }
                        }
                    } else {
                        // kann irgendein trumpf
                        if (e.srcElement.suit == theTrumpf) {
                            isValid = true;
                        }
                    }
                } else {
                    //hat weder firstcard suit noch trumpf
                    // wirf was du willst
                    isValid = true;
                }
                if (isValid) {
                    socket.emit('steche', {suit: e.srcElement.suit, value: e.srcElement.value, eyes: e.srcElement.eyes});
                    var cardIdx = myCards.findIndex(x => x.suit == e.srcElement.suit && x.eyes == e.srcElement.eyes);
                    myCard.splice(cardIdx, 1);
                    oDivCards.removeChild(e.srcElement);  
                    myStechTurn = false;
                } else {
                    e.srcElement.classList.add("clInvalidCard");
                    setTimeout(function() {
                        e.srcElement.classList.remove("clInvalidCard");
                    }.bind(this), 500);
                }             
            } 
    } else if (myDabTurn) {
        if (!e.srcElement.open) {
            aDab[e.srcElement.idx].open = true;
            e.srcElement.open = true;
            // open dab
            socket.emit('dabopen', e.srcElement.idx);
            var iClosedDab = aDab.findIndex(x => x.open == undefined);
            if (iClosedDab === -1) {
                setTimeout(function() {
                    // wenn alle offen
                    showElement("idButtonMelden", "block");
                    document.getElementById("idButtonMelden").disabled = true;
                    showElement("idDivTrumpf");
                    hideElement("idButtonDabOpen");
                    var oDivDab = document.getElementById("idDivDab");
                    oDivDab.innerHTML = "";
                    setTimeout(addToMyCards.bind(this, aDab), 1000);
                    myMeldeTurn = true;
                    myDabTurn = false;
                    myGame = true;
                }.bind(this), 1000);
                
            }
        }
    } else if (myMeldeTurn) {
        changeCardMeldeState(e.srcElement);
        if ($(".cardmeldestatedrucke").length === aDab.length && myTrumpf) {
            // genug gedruckt
            document.getElementById("idButtonMelden").disabled = false;
        } else {
            if (myGame) {
                document.getElementById("idButtonMelden").disabled = true;
            }
        }
    }
}

/*
*
* DOM UTILS
*
*/
function updatePlayer(players) {
    var aPlayerLocConfig = [
        ["idPlayerBottom", "idPlayerTop"],
        ["idPlayerBottom", "idPlayerMidTwo", "idPlayerTop"],
        ["idPlayerBottom", "idPlayerMidTwo", "idPlayerTop", "idPlayerMidOne"]
    ];
    var playerIdx = players.findIndex(x => x.id === socket.id);
    for (var i = 0; i < players.length; i++) {
        // TODO update the labels
        document.getElementById(aPlayerLocConfig[players.length - 2][i]).innerHTML = players[playerIdx].name;
        playerIdx = playerIdx == players.length - 1 ? 0 : playerIdx + 1;
    }
}

function changeCardMeldeState(card) {
    var cardstate = card.state;
    if (!cardstate) {
        cardstate = "melden";
        card.classList.add("cardmeldestate" + cardstate);
    } else if (cardstate == "melden") {
        if (!myGame) {
            cardstate = "";
        } else {
            cardstate = "drucke";
            card.classList.add("cardmeldestate" + cardstate);
        }
        card.classList.remove("cardmeldestatemelden");
    } else if (cardstate == "drucke") {
        cardstate = "";
        card.classList.remove("cardmeldestatedrucke");
    }
    card.state = cardstate;
}

function addToMyCards(cards) {
    myCards = myCards.concat(cards);
    myCards = myCards.sort(compareCards);
    var oDivCards = document.getElementById("idDivCards");
    oDivCards.innerHTML = "";
    for(var i in myCards) {
        var oCardButton = document.createElement("button");
       // oCardButton.textContent = myCards[i].suit + " " + myCards[i].value;
        oCardButton.textContent = myCards[i].value;
        oCardButton.value = myCards[i].value;
        oCardButton.suit = myCards[i].suit;
        oCardButton.eyes = myCards[i].eyes;
        oCardButton.style.backgroundImage = "url(/static/img/" + myCards[i].suit + ".png)";
        oCardButton.className = "card playercard";
        oCardButton.onclick = onClickCard.bind(oCardButton);
        oDivCards.appendChild(oCardButton);
    } 
}

function showReizValue(data) {
    var aPlayerLocConfig = [
        ["bottom", "top"],
        ["bottom", "right", "top"],
        ["bottom", "right", "top", "left"]
    ];
    var playerIdx = thePlayers.findIndex(x => x.id === socket.id);
    var i = 0;
    for (i; i < thePlayers.length; i++) {
        // TODO update the labels+
        if (thePlayers[playerIdx].id == data.reizIDlast) {
            break;
        }
        playerIdx = playerIdx == thePlayers.length - 1 ? 0 : playerIdx + 1;
    }

    var className = aPlayerLocConfig[thePlayers.length - 2][i];
    $('#idMeldeBubble').removeClass('bottom').removeClass('top').removeClass('right').removeClass('left');
    document.getElementById("idMeldeBubble").classList.add(className);
    document.getElementById("idMeldeBubble").innerText = data.reizVal;
    showElement("idMeldeBubble");
}

function compareCards(card1, card2){
    if(card1.suit > card2.suit)
        return - 1;
    if(card2.suit > card1.suit)
        return 1;
    if(card1.eyes > card2.eyes)
        return -1;
    if(card2.eyes > card1.eyes)
        return 1;
    return 0;
}

function removeElement(id) {
    var element = document.getElementById(id);
    element.parentNode.removeChild(element);
}

function showElement(id, display) {
    document.getElementById(id).style.display = display ? display: "flex";
}

function hideElement(id) {
    document.getElementById(id).style.display = 'none';
}

/*
*   ELEMENT SECTION
*
*/

function buildLobbyPlayer(parent, player, showteam ) {
    var playerdiv = document.createElement("div");
    playerdiv.setAttribute("className", "player");
    var name = document.createElement("span");
    name.innerHTML = player.name;
    playerdiv.appendChild(name);
    /*
    var points = document.createElement("span");
    points.innerHTML = player.points;
    playerdiv.appendChild(points);
    */
    if (showteam) {
        var team = document.createElement("span");
        team.innerHTML = player.team;
        playerdiv.appendChild(team);
    }
    var ready = document.createElement("span");
    ready.innerHTML = player.ready ? "READY" : "";
    playerdiv.appendChild(ready);
    parent.appendChild(playerdiv);
}