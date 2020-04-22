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
var theGameStats = {};

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
    hideElement("idReizBubble");
    //stichkarten clearen
    var oDivStich = document.getElementById('idDivStich');
    oDivStich.innerHTML = "";
    //myCards
    addToMyCards(data.cards);
    // dab
    aDab = data.dab;
    var oDivDab = document.getElementById("idDivDab");
    oDivDab.innerHTML = "";
    for (var i in data.dab) {
        var oCardButton = document.createElement("button");
        oCardButton.id = "idDabCard" + i;
        oCardButton.idx = i;
        oCardButton.className = "card dabcard umgedeckt";
        oCardButton.onclick = onClickCard.bind(oCardButton);
        oDivDab.appendChild(oCardButton); 
    }
    showElement("idDivDab");

})

socket.on('dabopened', function(data) {
    var oCardButton = document.getElementById("idDabCard" + data.idx);
    oCardButton.classList.remove("umgedeckt");
    oCardButton.open = true;
    oCardButton.style.backgroundImage = "url(/static/img/" + data.card.suit + ".png)";
    oCardButton.value = data.card.value;
    oCardButton.suit = data.card.suit;
    oCardButton.eyes = data.card.eyes;
    var oValue = document.createElement("span");
    oValue.textContent = data.card.value;
    oCardButton.appendChild(oValue);
})

socket.on('openrooms', function(data) {
    //document.getElementById("idLabelRooms").innerHTML = JSON.stringify(Object.keys(data));
    var oDivRooms = document.getElementById("idDivOpenRooms");
    
    if (oDivRooms) {
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
            item.setAttribute("class", "clOpenRoomItem")
            var roomname = document.createElement("span");
            roomname.innerHTML = room;
            var players = document.createElement("span");
            players.innerHTML = data[room].aPlayers.length;
            players.setAttribute("id", "idPlayers" + room);
            item.roomname = room;
            item.onclick = onJoinRoom.bind(item);
            item.appendChild(roomname);
            item.appendChild(players);
            oDivRooms.appendChild(item);
            console.log();
        }.bind(this));
    
        weg.forEach(function(room) {
            // room löschen
        }.bind(this));
        openRooms = data;
    }
})

socket.on('roomplayers', function(data) {
    if (data.length < 4) {
        hideElement("idDivChooseTeam");
    } else {
        showElement("idDivChooseTeam");
    }
    if (!gameStarted) {
        var oDivPlayers = document.getElementById("idDivPlayerLobby");
        oDivPlayers.innerHTML = "";
        data.forEach(function(player) {
            buildLobbyPlayer(oDivPlayers, player, data.length > 3);
        }.bind(this));
    }
})

socket.on('resetready', function() {
    enableReady(true);
})

socket.on('canstartgame', function() {
    setTimeout(function() {
        var readybutton = document.getElementById("idButtonReady");
        readybutton.innerHTML = "START";
        readybutton.disabled = false;
    }.bind(this), 1000);
 
})

socket.on('gamestarted', function(data) {
    gameStarted = true;
    thePlayers = data;
    theGameStats = {};
    updatePlayer();

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
    showCurrentZug(data.reizIDnext);
    if (data.reizIDlast) {
        showReizValue(data);
        document.getElementById("idInputReiz").value = parseInt(data.reizVal) + 10;
    } else {
        document.getElementById("idInputReiz").value = parseInt(data.reizVal);
    }

    if (data.reizIDnext === socket.id) {
        // du reizst
        showElement("idDivReiz");
    } 
})

socket.on('weggegangen', function(data) {
    updatePlayer(data);
})

socket.on('reizdone', function(data) {
    showCurrentZug(data.reizID);
    $('.weggegangen').removeClass('weggegangen');
    if (data.reizID === socket.id) {
        // du hast es game
        myDabTurn = true;
        showElement("idButtonDabOpen", "block");
    }
})

socket.on('darfmelde', function(data) {
    if (data.id === socket.id) {
        myMeldeTurn = true;
        showElement("idDivMelden");
    }
    showCurrentZug(data.id);
})

socket.on('gemeldet', function(data) {
    if (data.trumpf) {
        theTrumpf = data.trumpf;
        showTrumpf(data.trumpf);
    }
    hideElement("idDivDab");
    showMeldung(data);
})

socket.on('meldedone', function(data) {
    console.log(data);
    // TODO show every meldung immern ur ein interval? Problem: Wie kann man die in reihe hintereinander anzeigen?
    setTimeout(function() {
        hideElement("idDivMeldungen");
        showElement("idDivStich");
    }.bind(this), 1000);
})

socket.on('darfstechen', function(data) {
    showCurrentZug(data.stecherID);
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
        setTimeout(function() {
            showStichWin(data);
        }.bind(this), 500);
        
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

socket.on('gamestats', function(data) {
    theGameStats = data;
    console.log(data);
    if (data.roundEnd) {
        showGameStats();
    }

})

// BUTTON HANDLERS
function onEnterName() {
    myName = document.getElementById("idInputName").value;
    if (myName) {
        removeElement("idDivName");
        showElement("idDivRooms");
    }
}
function onCreateRoom() {
    var sRoomname = myName + "'s Raum";
    if (sRoomname) {
        socket.emit('createroom', {room: sRoomname, name: myName});
        myRoom = sRoomname;
        document.getElementById("idLabelRoomname").innerHTML = sRoomname;
        removeElement("idDivRooms");
        showElement("idDivLobby");
    }
}

function onJoinRoom(e) {
    var sRoomname = e.srcElement.roomname ? e.srcElement.roomname : e.srcElement.parentElement.roomname;
    socket.emit('joinroom', {room: sRoomname, name: myName})
    removeElement("idDivRooms")
    myRoom = sRoomname;
    document.getElementById("idLabelRoomname").innerHTML = sRoomname;
    showElement("idDivLobby");
}

function chooseTeam(button) {
    button.parentElement.childNodes.forEach(function (child) {
        if (child.classList) {
            child.classList.remove("selected");
        }
    }.bind(this));
    $(button).addClass("selected");
    socket.emit('chooseteam', button.id);
}

function onClickReady(button) {
    if (button.textContent == "READY") {
        socket.emit('ready');
        enableReady(false);
    } else {
        socket.emit('startgame');
    }
}

function onHandOut() {
    hideElement("idButtonHandOut");
    socket.emit('handout');
}

function onClickPlus() {
    var oInput = document.getElementById("idInputReiz");
    oInput.value = parseInt(oInput.value) + 10;
}

function onReiz() {
    var reizval = parseInt(document.getElementById("idInputReiz").value);
    hideElement("idDivReiz");
    socket.emit('reizval', reizval);
}

function onWeg() {
    hideElement("idDivReiz");
    socket.emit('reizweg');
}

function onMelden() {
    //hideElement("idButtonMelden");
    hideElement("idDivMelden");
    hideElement("idDivTrumpf");
    $('.activetrumpf').removeClass('activetrumpf');
    myMeldeTurn = false;

    var aGemeldet = [];
    $(".cardmeldestatemelden").each(function() {
        aGemeldet.push({
            value: this.value,
            suit: this.suit
        });
    });
    $(".cardmeldestatemelden").removeClass("cardmeldestatemelden");

    var aGedruckt = [];
    $(".cardmeldestatedrucke").each(function() {
        aGedruckt.push({
            card : {
                value: this.value,
                suit: this.suit,
                eyes: this.eyes
            }
        });
        var cardIdx = myCards.findIndex(x => x.suit == this.suit && x.eyes == this.eyes);
        myCards.splice(cardIdx, 1);

        this.parentNode.removeChild(this);
    });
    updateCardPosition();
    
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
            button.classList.remove("activetrumpf");
        } else {
            button.classList.add("activetrumpf");
            myTrumpf = button.value;
        }
    }
    if ($(".cardmeldestatedrucke").length === aDab.length && myTrumpf) {
        // genug gedruckt
        document.getElementById("idButtonMelden").disabled = false;
    }
}

function onClickCard(e) {
    // TODO: when is my turn, when wird gestochen/sortiert
    var clickedCard = e.currentTarget;
    if (myStechTurn && clickedCard.suit) {
            var oDivCards = document.getElementById("idDivCardsOne");
            var oStichCards = document.getElementById("idDivStich");
            var isValid = false;
            //leg karte
            //hab ich karte suit oder trumpf
            if (oStichCards.childElementCount == thePlayers.length || !oStichCards.hasChildNodes() ) {
                socket.emit('steche', {suit: clickedCard.suit, value: clickedCard.value, eyes: clickedCard.eyes});
                var cardIdx = myCards.findIndex(x => x.suit == clickedCard.suit && x.eyes == clickedCard.eyes);
                myCards.splice(cardIdx, 1);
                
                oDivCards.removeChild(clickedCard);
                updateCardPosition();
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
                            if (clickedCard.suit == firstCard.suit) {
                                isValid = true;
                            }
                        } else {
                            // muss stichwinner stechen
                            var iCanIStech = myCards.findIndex(x => x.eyes > theStichWinner.card.eyes && x.suit == theStichWinner.card.suit);
                            if (iCanIStech != -1) {
                                if (clickedCard.suit == firstCard.suit && clickedCard.eyes > theStichWinner.card.eyes) {
                                    isValid = true;
                                }
                            } else {
                                if (clickedCard.suit == firstCard.suit) {
                                    isValid = true;
                                }
                            }
                            
                        }
                    } else {
                         // muss stechen
                         var iCanIStech = myCards.findIndex(x => x.eyes > theStichWinner.card.eyes && x.suit == firstCard.suit);
                         if (iCanIStech != -1) {
                             if (clickedCard.suit == firstCard.suit && clickedCard.eyes > theStichWinner.card.eyes) {
                                 isValid = true;
                             }
                         } else {
                             if (clickedCard.suit == firstCard.suit) {
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
                            if (clickedCard.suit == theTrumpf && clickedCard.eyes > theStichWinner.card.eyes) {
                                isValid = true;
                            }
                        } else {
                            // kann irgendein trumpf
                            if (clickedCard.suit == theTrumpf) {
                                isValid = true;
                            }
                        }
                    } else {
                        // kann irgendein trumpf
                        if (clickedCard.suit == theTrumpf) {
                            isValid = true;
                        }
                    }
                } else {
                    //hat weder firstcard suit noch trumpf
                    // wirf was du willst
                    isValid = true;
                }
                if (isValid) {
                    socket.emit('steche', {suit: clickedCard.suit, value: clickedCard.value, eyes: clickedCard.eyes});
                    var cardIdx = myCards.findIndex(x => x.suit == clickedCard.suit && x.eyes == clickedCard.eyes);
                    myCards.splice(cardIdx, 1);
                    oDivCards.removeChild(clickedCard);  
                    updateCardPosition();
                    myStechTurn = false;
                } else {
                    clickedCard.classList.add("clInvalidCard");
                    setTimeout(function() {
                        clickedCard.classList.remove("clInvalidCard");
                    }.bind(this), 500);
                }             
            } 
    } else if (myDabTurn) {
        if (!clickedCard.open) {
            aDab[clickedCard.idx].open = true;
            clickedCard.open = true;
            // open dab
            socket.emit('dabopen', clickedCard.idx);
            var iClosedDab = aDab.findIndex(x => x.open == undefined);
            if (iClosedDab === -1) {
                setTimeout(function() {
                    // wenn alle offen
                    showElement("idDivMelden");
                    //showElement("idButtonMelden", "block");
                    showElement("idDivTrumpf");

                    document.getElementById("idButtonMelden").disabled = true;
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
    } else if (myMeldeTurn && clickedCard.suit) {
        changeCardMeldeState(clickedCard);
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

function onHideModal() {
    hideElement("idModal");
}

/*
*
* DOM UTILS
*
*/
function updatePlayer(playerweg) {
    var aPlayerLocConfig = [
        ["idPlayerBottom", "idPlayerTop"],
        ["idPlayerBottom", "idPlayerMidTwo", "idPlayerTop"],
        ["idPlayerBottom", "idPlayerMidTwo", "idPlayerTop", "idPlayerMidOne"]
    ];
    var playerIdx = thePlayers.findIndex(x => x.id === socket.id);
    for (var i = 0; i < thePlayers.length; i++) {
        // TODO update the labels
        if (playerweg === thePlayers[playerIdx].id) {
            document.getElementById(aPlayerLocConfig[thePlayers.length - 2][i]).classList.add("weggegangen");
           // document.getElementById(aPlayerLocConfig[thePlayers.length - 2][i]).innerHTML += "weg";
        }
        document.getElementById(aPlayerLocConfig[thePlayers.length - 2][i]).innerHTML = thePlayers[playerIdx].name;
        playerIdx = playerIdx == thePlayers.length - 1 ? 0 : playerIdx + 1;
    }
}

function enableReady(bEnabled) {
    var readybutton = document.getElementById("idButtonReady");
    readybutton.innerHTML = "READY";
    if (bEnabled) {
        readybutton.disabled = false;
    } else {
        readybutton.disabled = true;
    }
}

function showCurrentZug(id) {
    var aPlayerLocConfig = [
        ["idPlayerBottom", "idPlayerTop"],
        ["idPlayerBottom", "idPlayerMidTwo", "idPlayerTop"],
        ["idPlayerBottom", "idPlayerMidTwo", "idPlayerTop", "idPlayerMidOne"]
    ];
    var playerIdx = thePlayers.findIndex(x => x.id === socket.id);
    for (var i = 0; i < thePlayers.length; i++) {
        $("#" + aPlayerLocConfig[thePlayers.length - 2][i]).removeClass("pulseit");
        if (id == thePlayers[playerIdx].id) {
            $("#" + aPlayerLocConfig[thePlayers.length - 2][i]).addClass("pulseit");
        }
        playerIdx = playerIdx == thePlayers.length - 1 ? 0 : playerIdx + 1;
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
    var oDivCards = document.getElementById("idDivCardsOne");
    oDivCards.innerHTML = "";
    for(var i in myCards) {
        var oCardButton = document.createElement("button");
        var oValue = document.createElement("span");
        oValue.textContent = myCards[i].value;
        oCardButton.value = myCards[i].value;
        oCardButton.suit = myCards[i].suit;
        oCardButton.eyes = myCards[i].eyes;
        oCardButton.style.backgroundImage = "url(/static/img/" + myCards[i].suit + ".png)";
        oCardButton.className = "card playercard";
        oCardButton.onclick = onClickCard.bind(oCardButton);
        oCardButton.appendChild(oValue);
        var left = i % 7 * 14;
        var top = Math.trunc(i / 7) * 104;
        oCardButton.style.left = -100;
        oCardButton.style.top = top + "%";
        oDivCards.appendChild(oCardButton);
        setTimeout(slideIn.bind(this, oCardButton, left), 500);
    }

    function slideIn(elm, left) {
        elm.style.left = left + "%";
    }

   
}
function updateCardPosition() {
    var oDivCards = document.getElementById("idDivCardsOne");
    for (var i = 0; i < oDivCards.childNodes.length; i++) {
        var oCard = oDivCards.childNodes[i];
        var left = i % 7 * 14;
        var top = Math.trunc(i / 7) * 104;
        oCard.style.left = left + "%";
        oCard.style.top = top + "%";
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
    $('#idReizBubble').removeClass('bottom').removeClass('top').removeClass('right').removeClass('left');
    setTimeout(function() {
        $("#idReizBubble").addClass(className);
        $("#idReizBubble").css("background-image", "");
        document.getElementById("idReizBubble").innerText = data.reizVal;
        showElement("idReizBubble");
    }.bind(this), 100);
}

function showTrumpf(trumpf) {
    var oReizBubble = document.getElementById("idReizBubble");
    oReizBubble.style.backgroundImage = "url(/static/img/" + trumpf + ".png)";
    oReizBubble.textContent = "";
    showElement("idReizBubble");
}

function showStichWin(data) {
    var aPlayerLocConfig = [
        ["bottom", "top"],
        ["bottom", "right", "top"],
        ["bottom", "right", "top", "left"]
    ];
    var playerIdx = thePlayers.findIndex(x => x.id === socket.id);
    var i = 0;
    for (i; i < thePlayers.length; i++) {
        // TODO update the labels+
        if (thePlayers[playerIdx].id == data.stichwinner.playerid) {
            break;
        }
        playerIdx = playerIdx == thePlayers.length - 1 ? 0 : playerIdx + 1;
    }

    var className = aPlayerLocConfig[thePlayers.length - 2][i];
    $("#idDivStich").addClass(className);
    setTimeout(function() {
        $('#idDivStich').removeClass(className);
       // $('#idDivStich').html("");
    }.bind(this), 1500);
}

function showMeldung(data) {
    showElement("idDivMeldungen");
    var oDiv = document.getElementById("idDivMeldungen");
    oDiv.innerHTML = data.name + " meldet " + data.punkte;
    var topPx = 0;
    data.meldungen.forEach(function(meldung) {
     //   oDiv.innerHTML += "</br>";
      //  oDiv.innerHTML += meldung.combi + " - ";
        var oMeldungRow = document.createElement("div");
        oMeldungRow.className = "meldecardRow";
        meldung.cards.forEach(function(card) {
            var oCardButton = document.createElement("button");
            var oValue = document.createElement("span");
            oValue.textContent = card.value;
            oCardButton.style.backgroundImage = "url(/static/img/" + card.suit + ".png)";
            oCardButton.className = "card meldecard";
            oCardButton.appendChild(oValue);
            oMeldungRow.appendChild(oCardButton);
        });
        oDiv.appendChild(oMeldungRow);
    }.bind(this));
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
    playerdiv.className = "player";
    var name = document.createElement("span");
    name.innerHTML = player.name;
    playerdiv.appendChild(name);
    /*
    var points = document.createElement("span");
    points.innerHTML = player.points;
    playerdiv.appendChild(points);
    */
    if (showteam) {
        playerdiv.className += " team-" + player.team;
    }
    if (!player.ready) {
        playerdiv.className += " notready";
    }
    parent.appendChild(playerdiv);
}

function showGameStats() {
    var oModal = document.getElementById("idModalContent");
    oModal.innerHTML = "";
    if (!Object.keys(theGameStats).length ) {
        return;
    }
    // First Column

    var oFirstColumn = document.createElement("div");
    oFirstColumn.innerHTML += "</br>";
    theGameStats.stats[Object.keys(theGameStats.stats)[0]].forEach(function(playerstat) {
        oFirstColumn.innerHTML += playerstat.type.substring(0,1) + "</br>";
    }.bind(this));
    oModal.appendChild(oFirstColumn);
    // Player Columns
    for (var stat in theGameStats.stats) {
        var oColumn = document.createElement("div");
        oColumn.innerHTML += stat + "</br>";
        theGameStats.stats[stat].forEach(function(playerstat) {
            if (playerstat.val) {
                oColumn.innerHTML += playerstat.val + "</br>";
            } else {
                oColumn.innerHTML += "</br>";
            }
        }.bind(this));
        var points = document.createElement("label");
        points.innerHTML = theGameStats.points[stat];
        oColumn.appendChild(points);
        oModal.appendChild(oColumn);
    }
    showElement("idModal", "flex");
}
