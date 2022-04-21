# node-red-contrib-socketio-ack
Implementation for [Node-RED](https://nodered.org/) of the popular [Socket.IO](http://socket.io/).

from original project node-red-contrib-socketio, forked from node-red-contrib-socketio-javis86 to include CORS support.

Note: This node-red library is not functionally compatable with the above mentioned packages. The socketio - in and socketio - out node pass an array object for socketio arguments (the previous libraries only supported a single argument). Additionally, the socket - in node will return an optional msg.callback function if the client requested an acknowledge. It is the responsibility of your node-red flows to respond to this acknowledgement by calling the msg.callback function.

## Installation
To install node-red-contrib-socketio use this command

`npm i node-red-contrib-socketio-ack`

## Composition
The Socket.IO implementation is made with
* 1 configuration Node that holds the server definitions and the user can decide to bind the SocketIO server on the Node-RED port or bind it to another port
* 1 input node where the user adds all the `topic`s in which they are interested
* 1 output node that sends the data received into `msg.payload`
* 1 node to join a Socket IO room
* 1 node to leave a Socket IO room

## Usage
To see an example usage go to [Example Chat App](https://flows.nodered.org/flow/71f7da3a14951acb67f94bac1f71812a)

## License
MIT

## Thanks
Thank to: 
* @nexflo for translating the comments in English and for pre-sending control data 
* @bimalyn-IBM for implementig rooms
* @essuraj for implementig rooms listing node
* @cazellap for pushong adding compatibility to socketIO 3.0
* @javis86 individual contributor for fixing node-red hangs when deploy flows
* @javis86 for adding CORS support


