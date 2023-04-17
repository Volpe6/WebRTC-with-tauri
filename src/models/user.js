import Message from "./message";
import Peer from "./peer";

class User {
    constructor(name) {
        this.id = name;
        this.name = name;
        this.peer = null;
        this.messages = [];
        this.observers = [];
    }

    getMessages() { return this.messages; }

    getPeerConnection() { return this.peer;}

    attachObserver(obs) { this.observers.push(obs); }

    async createConnection(userName, stream) {
        try {
            this.peer = new Peer();
            // let screen = await navigator.mediaDevices.getDisplayMedia();
            //todo Como responder APENAS com transceptores. https://blog.mozilla.org/webrtc/rtcrtptransceiver-explored/
            this.peer.addTransceiver(
                stream.getVideoTracks()[0], 
                {streams: [stream]}
            );
            this.peer.addTransceiver(
                stream.getAudioTracks()[0], 
                {streams: [stream]}
            );
            // this.peer.addTransceiver(
            //     screen.getVideoTracks()[0], 
            //     {streams: [screen]}
            // );
            this.peer.name = userName;
            this.peer.target = this.name;
            this.peer.attachObserver(async (content) => this._notify(content));
        } catch (e) {
            console.log(`handlePeerConnection() error: ${e.toString()}`);
            alert(`handlePeerConnection() error: ${e.toString()}`);
        }
        this.peer.createOffer();
    }

    send(data) {
        if(!this.peer) {
            throw new Error('a conexao nao foi estabelecida');
        }
        if(!this.getPeerConnection().channel || this.getPeerConnection().channel.readyState !== 'open') {
            throw new Error('o canal de comunicacao nao foi aberto')
        }
        this.peer.send(data);
        this._addMessage(this.peer.name, this.peer.target, data);
    }

    receive(data) {
        if(!this.peer) {
            throw new Error('a conexao nao foi estabelecida');
        }
        this._addMessage(this.peer.target, this.peer.name, data);
    }

    _addMessage(sender, receiver, data) { this.messages.push(new Message(sender, receiver, data)); }

    _notify(data) {
        const content = Object.assign({name: this.name}, data);
        this.observers.forEach(obs => obs(content));
    }
}

export default User;