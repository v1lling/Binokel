
// GLOBAL VARIABLES
var socket = io();
var myName = "";
var myCards = [];
var myStechTurn = false;
var myDabTurn = false;
var openRooms = [];
var myRoom = "";
var aDab = [];

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
    myCards = data.cards;
    var oDivCards = document.getElementById("idDivCards");
    for(var i in data.cards) {
        var oCardButton = document.createElement("button");
        oCardButton.textContent = data.cards[i].suit + " " + data.cards[i].value;
        oCardButton.value = data.cards[i].value;
        oCardButton.suit = data.cards[i].suit;
        oCardButton.eyes = data.cards[i].eyes;
        oCardButton.className = "card playercard";
        oCardButton.onclick = onClickCard.bind(oCardButton);
        oDivCards.appendChild(oCardButton);
    }
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
    oCardButton.textContent = data.card.suit + " " + data.card.value;
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
    var oDivPlayers = document.getElementById("idDivPlayerLobby");
    oDivPlayers.innerHTML = "";
    data.forEach(function(player) {
        buildLobbyPlayer(oDivPlayers, player, data.length > 3);
    }.bind(this));
})

socket.on('resetready', function() {
    hideElement("idButtonStartGame");
    showElement("idButtonReady", "block");
})

socket.on('canstartgame', function() {
    showElement("idButtonStartGame");
})

socket.on('gamestarted', function() {
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
    if (data.reizID === socket.id) {
        // du reizst
        showElement("idDivReiz");
        document.getElementById("idButtonReiz").innerHTML = data.reizVal;
    } else {
        // jemand reizt
        console.log("jemand reizt ab " + data.reizVal + 10);
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
    showElement("idButtonMelden", "block");
})

socket.on('meldedone', function() {
    hideElement("idDivDab");
    showElement("idDivStich");
})

socket.on('darfstechen', function(data) {
    // show new card
    var oDivStich = document.getElementById('idDivStich');
    if (data.stiche.length) {
        oDivStich.innerHTML = "";
        data.stiche.forEach(function(stich) {
            var oCardButton = document.createElement("button");
            oCardButton.textContent = stich.card.suit + " " + stich.card.value;
            oCardButton.className = "card stichcard";
            oDivStich.appendChild(oCardButton);
        })
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
    hideElement("idDivReiz");
    socket.emit('reizval');
}

function onWeg() {
    hideElement("idDivReiz");
    socket.emit('reizweg');
}

function onMelden() {
    hideElement("idButtonMelden");
    socket.emit('melde', myCards);
}

function onClickCard(e) {
    // TODO: when is my turn, when wird gestochen/sortiert
    var bStechen = true;
    if (myStechTurn) {
        myStechTurn = false;
        if (bStechen) {
            // leg karte
            var oDivCards = document.getElementById("idDivCards");
            socket.emit('steche', {suit: e.srcElement.suit, value: e.srcElement.value, eyes: e.srcElement.eyes});
            oDivCards.removeChild(e.srcElement);
        
        } else {
            // karten aussortieren
        }
    } else if (myDabTurn) {
        if (e.srcElement.open === true) {
            // swap dab
        } else {
            aDab[e.srcElement.idx].open = true;
            e.srcElement.open = true;
            // open dab
            socket.emit('dabopen', e.srcElement.idx);
            var iClosedDab = aDab.findIndex(x => x.open == undefined);
            if (iClosedDab === -1) {
                // wenn alle offen
                showElement("idButtonMelden", "block");
                hideElement("idButtonDabOpen");
            }
        }
    }
}

/*
*
* DOM UTILS
*
*/

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