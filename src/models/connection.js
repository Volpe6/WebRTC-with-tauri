import { v4 as uuidv4 } from 'uuid';
import Message from "./message";
import Peer, { DISPLAY_TYPES } from "./peer";
import User from "./user";
import { getDisplayMedia, getUserMedia } from '../utils/mediaStream';

class Connection {
    constructor(name) {
        this.name = name;
        this.user = new User(name);
        this.peer = null;
        this.messages = [];
        this.observers = {};
        this.polite = null;

        this.displayStream = null;//do local
        this.userStream = null;//do local
    }

    getMessages() { return this.messages; }

    attachObserver(opts) { 
        const options = Object.assign({id:uuidv4()}, opts);
        this.observers[options.id] = options.obs; 
    }

    detachAllObserver() { this.observers={}; }
    
    detachObserver(id) { 
        const deleted = delete this.observers[id];
        if(!deleted) {
            throw new Error(`não foi possivel remover o observador ${id}`);
        }
        console.log(`observador removido ${id}`);
        console.log('observers', this.observers);
    }

    async getUserMedia(opts) {
        let stream = await getUserMedia(opts);
        if(this.userStream) {
            stream.getTracks().forEach(track => this.userStream.addTrack(track));
            stream = this.userStream;
        }
        this.userStream = stream;
        return stream;
    }

    async getDisplayMedia(opts) {
        this.displayStream = await getDisplayMedia(opts);
        return this.displayStream;
    }

    /**
     * Compartilha a camera d usuario. Se a camera ja estiver sendo compartilhada para o compartilhamento.
     * Ao contrario do codigo do compartilhamento da tela, nesse caso tenta utilizar a stream ja existente 
     * so adicionando os track ausentes 
     */
    async toogleCamera() {
        let stream = this.userStream;
        let videoTrack = null;
        //verifica se o user stream ja foi definido e se possui o track de video
        if(this.userStream && this.userStream.getVideoTracks()[0]) {
            console.log('possui stream a vidoe track');
            videoTrack = this.userStream.getVideoTracks()[0];
            // troca o estado atual do video(se ira mostra-lo ou nao). Caso falso mostra uma tela preta
            videoTrack.enabled = !videoTrack.enabled;
        }
        if(!videoTrack) {
            console.log('nao possui stream ou vidoe track');
            //se nao possui o track de video ele é requisitado
            stream = await this.getUserMedia({ video: true });
            videoTrack = stream.getVideoTracks()[0];
        }
        if(!this.peer) {
            console.log('atuamente sem conexao');
            this._notify({
                type: 'changeuserstream',
                data: stream
            });
            return stream;
        }
        const transceiver = this.peer.retriveTransceiver({ displayType: DISPLAY_TYPES.USER_CAM });
        if(!videoTrack.enabled) {
            transceiver.sender.replaceTrack(null);
            /** codigo utilizado para notificar o outro lado q track foi parado. Apenas utilizar
             *  replaceTrack(null) nao notifica o outro lado, e é indistinguivel de um problema de internet */
            transceiver.direction = 'recvonly';
            this._notify({
                type: 'changeuserstream',
                data: stream
            });
            return stream;
        }
        transceiver.direction = "sendrecv";
        transceiver.sender.replaceTrack(videoTrack);
        transceiver.sender.setStreams(stream);
        this._notify({
            type: 'changeuserstream',
            data: stream
        });
        return stream;
    }

    async toogleDisplay(opts) {
        const { onended } = opts;
        if(this.displayStream) {
            this.displayStream.getTracks().forEach(track => {
                track.stop();
                this.displayStream.removeTrack(track);
            });
            this.displayStream = null;
            this._notify({
                type: 'changedisplaystream',
                data: this.displayStream
            });
            return this.displayStream;
        }
        const stream = await this.getDisplayMedia();
        stream.getVideoTracks()[0].onended = () => {
            this.displayStream = null;
            if(onended) {
                onended();
            }
        };
        if(!this.peer) {
            console.log('atuamente sem conexao');
            this._notify({
                type: 'changedisplaystream',
                data: this.displayStream
            });
            return stream;
        }
        const transceiver = this.peer.retriveTransceiver({ displayType: DISPLAY_TYPES.DISPLAY });
        stream.getVideoTracks()[0].onended = () => {
            transceiver.sender.replaceTrack(null);
            transceiver.direction = 'recvonly';
            this.displayStream = null;
            if(onended) {
                onended();
            }
        };
        transceiver.direction = "sendrecv";
        transceiver.sender.replaceTrack(stream.getVideoTracks()[0]);
        transceiver.sender.setStreams(stream);
        this._notify({
            type: 'changedisplaystream',
            data: this.displayStream
        });
        return stream;
    }

    close() {
        this.peer.closed = true;
        this.peer.close();
        if(this.userStream) {
            this.userStream.getTracks().forEach(track => {
                track.stop();
                this.userStream.removeTrack(track);
            });
        }
        if(this.displayStream) {
            this.displayStream.getTracks().forEach(track => {
                track.stop();
                this.displayStream.removeTrack(track);
            });
        }
    }

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

export default Connection;