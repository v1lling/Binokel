
// GLOBAL VARIABLES
var socket = io();
var myCards = [];
var myStechTurn = false;

// SOCKET HANDLERS
socket.on('message', function(data) {
  console.log(data);
});

socket.on('dealer', function(data) {
    if (data === socket.id) {
        document.getElementById("idButtonHandOut").style.visibility = 'visible';
    }
})

socket.on('cards', function(data) {
    myCards = data;
    var oDivCards = document.getElementById("idDivCards");
    for(var i in data) {
        var oCardButton = document.createElement("button");
        oCardButton.textContent = data[i].suit + " " + data[i].value;
        oCardButton.value = data[i].value;
        oCardButton.suit = data[i].suit;
        oCardButton.eyes = data[i].eyes;
        oCardButton.className = "card playercard";
        oCardButton.onclick = onClickCard.bind(oCardButton);
        oDivCards.appendChild(oCardButton);
    }
})

socket.on('dabopened', function(data) {
    var oDivDab = document.getElementById("idDivDab");
    for(var i in data) {
        var oCardButton = document.createElement("button");
        oCardButton.textContent = data[i].suit + " " + data[i].value;
        oCardButton.value = data[i].value;
        oCardButton.suit = data[i].suit;
        oCardButton.eyes = data[i].eyes;
        oCardButton.className = "card dabcard";
        //oCardButton.onclick = onClickCard.bind(oCardButton);
        oDivDab.appendChild(oCardButton);
    }
    //document.getElementById("idLabelDab").innerHTML += JSON.stringify(data);
})

socket.on('openrooms', function(data) {
    document.getElementById("idLabelRooms").innerHTML = JSON.stringify(Object.keys(data));
})

socket.on('roomplayers', function(data) {
    document.getElementById("idLabelRoomPlayers").innerHTML = JSON.stringify(data);
})

socket.on('resetready', function() {
    document.getElementById("idButtonReady").style.visibility = 'visible';
})

socket.on('reizturn', function(data) {
    if (data.reizID === socket.id) {
        // du reizst
        document.getElementById("idDivReiz").style.visibility = 'visible';
        document.getElementById("idButtonReiz").innerHTML = data.reizVal;
    } else {
        // jemand reizt
        console.log("jemand reizt ab " + data.reizVal + 10);
    }
})

socket.on('reizdone', function(data) {
    if (data.reizID === socket.id) {
        // du hast es game
        document.getElementById("idButtonDabOpen").style.visibility = 'visible';
    } else {
        // jemand hat es game
        console.log("jemand hat reiz mit " + data.reizVal);
    } 
})

socket.on('darfmelde', function() {
    document.getElementById("idButtonMelden").style.visibility = "visible";
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
function onCreateRoom() {
    var sRoomname = document.getElementById("idInputCreateGameRoom").value;
    var sName = document.getElementById("idInputName").value;
    socket.emit('createroom', {room: sRoomname, name: sName});
}

function onJoinRoom() {
    var sRoomname = document.getElementById("idInputJoinGameRoom").value;
    var sName = document.getElementById("idInputName").value;
    socket.emit('joinroom', {room: sRoomname, name: sName})
}

function chooseTeam(radio) {
    socket.emit('chooseteam', radio.id);
}

function onClickReady() {
    document.getElementById("idButtonReady").style.visibility = 'hidden';
    socket.emit('ready');
}

function onHandOut() {
    document.getElementById("idButtonHandOut").style.visibility = 'hidden';
    socket.emit('handout');
}

function onReiz() {
    document.getElementById("idDivReiz").style.visibility = 'hidden';
    socket.emit('reizval');
}

function onWeg() {
    document.getElementById("idDivReiz").style.visibility = 'hidden';
    socket.emit('reizweg');
}

function onDabOpen() {
    document.getElementById("idButtonDabOpen").style.visibility = 'hidden';
    document.getElementById("idButtonMelden").style.visibility = "visible";
    socket.emit('dabopen');
}

function onMelden() {
    document.getElementById("idButtonMelden").style.visibility = "hidden";
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
    }
}