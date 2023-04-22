import { v4 as uuidv4 } from 'uuid';
import Message from "./message";
import Peer from "./peer";

class User {
    constructor(name) {
        this.id = name;
        this.name = name;
        this.peer = null;
        this.messages = [];
        this.observers = {};
        this.polite = null;
    }

    getMessages() { return this.messages; }

    getPeerConnection() { return this.peer;}

    attachObserver(opts) { 
        const options = Object.assign({id:uuidv4()}, opts);
        this.observers[options.id] = options.obs; 
    }

    detachObserver(id) { 
        const deleted = delete this.observers[id];
        if(!deleted) {
            throw new Error(`não foi possivel remover o observador ${id}`);
        }
        console.log(`observador removido ${id}`);
        console.log('observers', this.observers);
    }

    detachAllObserver() { this.observers={}; }

    async initPeer(userName) {
        try {
            this.peer = new Peer(this.polite);
            this.peer.name = userName;
            this.peer.target = this.name;
            this.peer.attachObserver({obs:async (content) => this._notify(content)});
        } catch (e) {
            throw new Error(`handlePeerConnection() error: ${e.toString()}`);
        }
        return this.peer;
    }

    // async createConnection(userName, stream) {
    //     try {
    //         this.peer = new Peer();
    //         // let screen = await navigator.mediaDevices.getDisplayMedia();
    //         //todo Como responder APENAS com transceptores. https://blog.mozilla.org/webrtc/rtcrtptransceiver-explored/
    //         this.peer.addTransceiver(
    //             stream.getVideoTracks()[0], 
    //             {streams: [stream]}
    //         );
    //         this.peer.addTransceiver(
    //             stream.getAudioTracks()[0], 
    //             {streams: [stream]}
    //         );
    //         // this.peer.addTransceiver(
    //         //     screen.getVideoTracks()[0], 
    //         //     {streams: [screen]}
    //         // );
    //         this.peer.name = userName;
    //         this.peer.target = this.name;
    //         this.peer.attachObserver(async (content) => this._notify(content));
    //     } catch (e) {
    //         console.log(`handlePeerConnection() error: ${e.toString()}`);
    //         alert(`handlePeerConnection() error: ${e.toString()}`);
    //     }
    //     this.peer.createOffer();
    // }

    send(data) {
        if(!this.peer) {
            throw new Error('a conexao nao foi estabelecida');
        }
        if(!this.peer.channel || this.peer.channel.readyState !== 'open') {
            throw new Error('o canal de comunicacao nao foi aberto')
        }
        const msg = this._addMessage(this.peer.name, this.peer.target, data);
        this.peer.send(JSON.stringify(msg));
    }
    
    receive(data) {
        if(!this.peer) {
            throw new Error('a conexao nao foi estabelecida');
        }
        this._addMessage(this.peer.target, this.peer.name, data);
    }

    _addMessage(sender, receiver, data) { 
        const msg = new Message(sender, receiver, data);
        this.messages.push(msg); 
        return msg;
    }

    _notify(data) {
        const content = Object.assign({name: this.name}, data);
        Object.values(this.observers).forEach(obs => obs(content));
    }
}

export default User;