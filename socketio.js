module.exports = function(RED) {
  const { Server } = require("socket.io");
  var io = {};
  var customProperties = {};

  function addListener(node, socket, val, i) {
    socket.on(val, function(...msgin) {
      var msg = {};
      if ((msgin.length > 0) && (typeof(msgin[msgin.length - 1]) === 'function')) {
        let msginnew = msgin.slice(0,-1);
        RED.util.setMessageProperty(msg, "callback", msgin[msgin.length - 1], true);
        RED.util.setMessageProperty(msg, "payload", (msginnew.length == 1) ? msginnew[0] : msginnew, true);
      }
      else
        RED.util.setMessageProperty(msg, "payload", (msgin.length == 1) ? msgin[0] : msgin, true);

      RED.util.setMessageProperty(msg, "socketIOEvent", val, true);
      RED.util.setMessageProperty(msg, "socketIOId", socket.id, true);
      if (
        customProperties[RED.util.getMessageProperty(msg, "socketIOId")] !=
        null
      ) {
        RED.util.setMessageProperty(
          msg,
          "socketIOStaticProperties",
          customProperties[RED.util.getMessageProperty(msg, "socketIOId")],
          true
        );
      }
      node.send(msg);
    });
  }

  function socketIoConfig(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.port = n.port || 80;
    this.sendClient = n.sendClient;
    this.path = n.path || "/socket.io";
    this.bindToNode = n.bindToNode || false;
    this.corsOrigins = n.corsOrigins || "*";
    this.corsMethods = n.corsMethods.toUpperCase().split(",") || "GET,POST";
    this.enableCors = n.enableCors || false;

    let corsOptions = {};

    if (this.enableCors) {
      corsOptions = {
        cors: {
          origin: this.corsOrigins,
          methods: this.corsMethods
        }
      };
    }

    if (this.bindToNode) {
      io[node.id] = {server: new Server(RED.server, corsOptions), sockets: {}};

    } else {
      io[node.id] = {server: new Server(corsOptions), sockets: {}};

      io[node.id].server.serveClient(node.sendClient);
      io[node.id].server.path(node.path);
      io[node.id].server.listen(node.port);
    }
    var bindOn = this.bindToNode
      ? "bind to Node-red port"
      : "on port " + this.port;
    node.log("Created server " + bindOn);

    node.on("close", function() {
      if (!this.bindToNode) {
        io[node.id].server.close();
      }
      for (let socket in io[node.id].sockets) {
        node.log('disconnect: ') + socket;
        io[node.id].sockets[socket].disconnect(true);
      }

      io[node.id].sockets = {};
    });
  }

  function socketIoIn(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);
    this.rules = n.rules || [];
    this.io = io[n.server];
    this.namespace = n.namespace || "/";

    node.log("Namespace: " + this.namespace);
    this.io.server.of(this.namespace).on("connection", (socket) => {
      //console.log(socket.id);
      //console.log(this.io.sockets);
      this.io.sockets[socket.id] = socket;
      node.rules.forEach(function(val, i) {
        addListener(node, socket, val.v, i);
      });
    });
  }

  function socketIoOut(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);
    this.io = io[n.server];
    this.namespace = n.namespace || "/";

    node.log("Namespace: " + this.namespace);
    node.on("input", function(msg) {
      this.payload = (msg.payload instanceof Array) ? msg.payload : [msg.payload];
      if (n.callback) {
        this.payload.push((callback) => {
          RED.util.setMessageProperty(msg, "payload", callback, true)
          node.send(msg);
        })
      }
      //check if we need to add properties
      if (RED.util.getMessageProperty(msg, "socketIOAddStaticProperties")) {
        //check if we have already added some properties for this socket
        if (
          customProperties[RED.util.getMessageProperty(msg, "socketIOId")] !=
          null
        ) {
          //check if object as property
          var keys = Object.getOwnPropertyNames(
            RED.util.getMessageProperty(msg, "socketIOAddStaticProperties")
          );
          var tmp =
            customProperties[RED.util.getMessageProperty(msg, "socketIOId")];
          for (var i = 0; i < keys.length; i++) {
            tmp[keys[i]] = RED.util.getMessageProperty(
              msg,
              "socketIOAddStaticProperties"
            )[keys[i]];
          }
        } else {
          //add new properties
          customProperties[
            RED.util.getMessageProperty(msg, "socketIOId")
          ] = RED.util.getMessageProperty(msg, "socketIOAddStaticProperties");
        }
      }

      switch (RED.util.getMessageProperty(msg, "socketIOEmit")) {
        case "broadcast.emit":
          //Return to all but the caller
          if (this.io.server.of(this.namespace).sockets.get(RED.util.getMessageProperty(msg, "socketIOId"))) {
            this.io.server.of(this.namespace).sockets.get(RED.util.getMessageProperty(msg, "socketIOId")).broadcast.emit(
              msg.socketIOEvent, ...this.payload);
          }
          break;
        case "emit":
          //Return only to the caller
          if (this.io.server.of(this.namespace).sockets.get(RED.util.getMessageProperty(msg, "socketIOId"))) {
            this.io.server.of(this.namespace).sockets.get(RED.util.getMessageProperty(msg, "socketIOId")).emit(
              msg.socketIOEvent, ...this.payload);
          }
          break;
        case "room":
          //emit to all
          if (msg.room) {
            this.io.server.of(this.namespace).to(msg.room).emit(msg.socketIOEvent, ...this.payload);
          }
          break;
        default:
          //emit to all
            this.io.server.of(this.namespace).emit(msg.socketIOEvent, ...this.payload);
      }
    });
  }

  function socketIoEvents(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.server = RED.nodes.getNode(n.server);
    this.io = io[n.server];
    this.namespace = n.namespace || "/";

    node.log("Namespace: " + this.namespace);
    this.io.server.of(this.namespace).on("connection", (socket) => {
      let msg = {};
      node.status({ fill: 'green', shape: 'dot', text: this.io.server.of(this.namespace).sockets.size + ' connected' });
      RED.util.setMessageProperty(msg, "socketIOEvent", "connected", true);
      RED.util.setMessageProperty(msg, "socketIOId", socket.id, true);
      node.send(msg);
      socket.on("disconnect", (reason) => {
        if (this.io.server.of(this.namespace).sockets.size)
          node.status({ fill: 'green', shape: 'dot', text: this.io.server.of(this.namespace).sockets.size + ' connected' });
        else {
          node.status({ fill: 'red', shape: 'dot', text: this.io.server.of(this.namespace).sockets.size + ' connected' });
        }
        RED.util.setMessageProperty(msg, "socketIOEvent", "disconnected", true);
        node.send(msg);
      });
    });
  }


  function socketIoJoin(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);
    this.io = io[n.server];
    this.namespace = n.namespace || "/";

    node.on("input", function(msg) {
      if (io.server.of(this.namespace).sockets.get(RED.util.getMessageProperty(msg, "socketIOId"))) {
        io.server.of(this.namespace).sockets.get(RED.util.getMessageProperty(msg, "socketIOId")).join(
          msg.payload.room
        );
        node.send(msg);
      }
    });
  }

  function socketIoRooms(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);
    this.io = io[n.server];
    this.namespace = n.namespace || "/";

    node.on("input", function(msg) {
      node.send({ payload: this.io.server.of(this.namespace).adapter.rooms });
    });
  }

  function socketIoLeave(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    this.name = n.name;
    this.server = RED.nodes.getNode(n.server);
    this.io = io[n.server];
    this.namespace = n.namespace || "/";

    node.on("input", function(msg) {
      if (this.io.server.of(this.namespace).sockets.get(RED.util.getMessageProperty(msg, "socketIOId"))) {
        this.io.server.of(this.namespace).sockets.get(
          RED.util.getMessageProperty(msg, "socketIOId")
        ).leave(msg.payload.room);
      }
    });
  }

  RED.nodes.registerType("socketio-server-config", socketIoConfig);
  RED.nodes.registerType("socketio-server-in", socketIoIn);
  RED.nodes.registerType("socketio-server-out", socketIoOut);
  RED.nodes.registerType("socketio-server-callback", socketIoOut);
  RED.nodes.registerType("socketio-server-events", socketIoEvents);
  RED.nodes.registerType("socketio-server-join", socketIoJoin);
  RED.nodes.registerType("socketio-server-rooms", socketIoRooms);
  RED.nodes.registerType("socketio-server-leave", socketIoLeave);
};
