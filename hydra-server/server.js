const fs = require('fs')
const express = require('express')
const app = express()
const browserify = require('browserify-middleware')
//const https = require('https')
const http = require('http')
const path = require('path')

//var privateKey = fs.readFileSync(path.join(__dirname, '/certs/key.pem'), 'utf8')
//var certificate = fs.readFileSync(path.join(__dirname, '/certs/certificate.pem'), 'utf8')

//var credentials = {key: privateKey, cert: certificate}
//var httpsServer = https.createServer(credentials, app)

/*function checkHttps(req, res, next){
  // protocol check, if http, redirect to https
  
  if(req.get('X-Forwarded-Proto').indexOf("https")!=-1){
    console.log("https, yo")
    return next()
  } else {
    console.log("just http")
    res.redirect('https://' + req.hostname + req.url);
  }
}

app.all('*', checkHttps)*/
var httpsServer = http.createServer(app)

var io = require('socket.io')(httpsServer)

app.get('/bundle.js', browserify(path.join(__dirname, '/app/coder.js')))
app.get('/camera-bundle.js', browserify(path.join(__dirname, '/app/camera.js')))
app.get('/bundle-viewer.js', browserify(path.join(__dirname, '/app/viewer.js')))

// crear un servidor en puerto 8000
httpsServer.listen(8000, function () {
  // imprimir la direccion ip en la consola
  // console.log('servidor disponible en https://'+myip.getLocalIP4()+':8000')
  console.log('server available at https://localhost:8000')
})

// look up uuid by entiring socket id
var userFromSocket = {}

// lookup socket id by entering uuid
var socketFromUser = {}

// new connection to websocket server
io.on('connection', function (socket) {
  console.log('new connection', socket.id)
  var thisRoom = null
  socket.on('join', function (room, _userData) {
    thisRoom = room
    console.log('user', JSON.stringify(_userData))
    if (_userData.uuid) {
      userFromSocket[socket.id] = _userData.uuid
      socketFromUser[_userData.uuid] = socket.id
    } else {
      console.log('no user data!')
    }
    // Get the list of peers in the room
    var peers = io.nsps['/'].adapter.rooms[room] ? Object.keys(io.nsps['/'].adapter.rooms[room].sockets) : []

    io.of('/').in(room).clients(function (error, clients) {
      if (error) throw error
      console.log(clients) // => [Anw2LatarvGVVXEIAAAD]
    })

    var peerUuids = peers.map(socketId => userFromSocket[socketId])

    // Send them to the client
    socket.emit('ready', socket.id, peerUuids)

    // And then add the client to the room
    socket.join(room)

    // send updated list of peers to all clients in room
    // io.sockets.emit('peers', peerUuids);
    socket.to(thisRoom).emit('new peer', _userData.uuid)
  })

  socket.on('broadcast', function (data) {
    // io.sockets.emit('broadcast', data)
    console.log('broadcasting', data, socket.room)
    //  io.sockets.in(socket.room).emit('broadcast', data)
    socket.to(thisRoom).emit('broadcast', data)
  })

  socket.on('eval code', function(data){
    console.log('evaling code')
    socket.to(thisRoom).emit('eval code', data)
  })
  // pass message from one peer to another
  socket.on('message', function (data) {
    var client = io.sockets.connected[socketFromUser[data.id]]
    client && client.emit('message', {
      id: userFromSocket[socket.id],
      label: socket.label,
      message: data.message,
      type: data.type
    })
  })

  socket.on('signal', function (data) {
    console.log('forwarding signal ' + JSON.stringify(data))
    var client = io.sockets.connected[socketFromUser[data.id]]
    client && client.emit('signal', {
      id: userFromSocket[socket.id],
      label: socket.label,
      signal: data.signal
    })
  })
  // TO DO: on disconnect, remove from label dictionary
})

app.use(express.static(path.join(__dirname, '/public')))
