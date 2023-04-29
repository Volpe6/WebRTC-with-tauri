import { v4 as uuidv4 } from 'uuid';
import Message, { TYPES as MESSAGE_TYPES } from "./message";
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

    async toogleUserTrack(opts) {
        function getTrackFromStream(opts) {
            const trackType = {
                video: (stream) => stream.getVideoTracks()[0],
                audio: (stream) => stream.getAudioTracks()[0]
            };
            const { mediaType, stream } = opts;
            const getTrack = trackType[mediaType];
            if(getTrack) {
                return getTrack(stream);
            }
            throw new Error(`nao foi fonecido o um tipo valido. Tipo fornecido: ${mediaType}`);
        }
        const { mediaType, displayType, mediaConfig,  enabled } = opts;
        const notify = {
            type: 'changeuserstream',
            data: { mediaType: mediaType }
        };
        let stream = this.userStream;
        let track = null;
        //verifica se o user stream ja foi definido e se possui o track especifico
        if(this.userStream && getTrackFromStream({mediaType, stream: this.userStream})) {
            track = getTrackFromStream({mediaType, stream: this.userStream});
            // se for video. troca o estado atual do video(se ira mostra-lo ou nao). Caso falso mostra uma tela preta
            // se for audio, muta ou desmuta
            track.enabled = !track.enabled;
        }
        if(!track) {
            //se nao possui o track de video/audio ele é requisitado
            stream = await this.getUserMedia(mediaConfig);
            track = getTrackFromStream({mediaType, stream: stream});
        }
        if(enabled) {
            track.enabled = enabled;
        }
        notify.data.stream = stream;
        if(!this.peer || this.peer.pc.getTransceivers().length === 0) {
            console.log('atuamente sem conexao ou sem nenhum transiver. A stream ainda sera retornada, mas nao anexada ao transiver');
            this._notify(notify);
            return stream;
        }
        const transceiver = this.peer.retriveTransceiver({ displayType });
        if(!track.enabled) {
            transceiver.sender.replaceTrack(null);
            /** codigo utilizado para notificar o outro lado q track foi parado. Apenas utilizar
             *  replaceTrack(null) nao notifica o outro lado, e é indistinguivel de um problema de internet */
            transceiver.direction = 'recvonly';
            this._notify(notify);
            return stream;
        }
        transceiver.direction = "sendrecv";
        transceiver.sender.replaceTrack(track);
        transceiver.sender.setStreams(stream);
        this._notify(notify);
        return stream;
    }

    /**
     * Compartilha o audio d usuario. Se o audio ja estiver sendo compartilhada para o compartilhamento.
     * tenta utilizar a stream ja existente so adicionando os track ausentes 
     */
    async toogleAudio(opts) {
        const { enabled } = opts;
        return await this.toogleUserTrack({
            mediaType: 'audio',
            displayType: DISPLAY_TYPES.USER_AUDIO,
            mediaConfig: {audio: true},
            enabled
        });
    }

    /**
     * Compartilha a camera d usuario. Se a camera ja estiver sendo compartilhada para o compartilhamento.
     * Ao contrario do codigo do compartilhamento da tela, nesse caso tenta utilizar a stream ja existente 
     * so adicionando os track ausentes 
     */
    async toogleCamera(opts) {
        const { enabled } = opts;
        return await this.toogleUserTrack({
            mediaType: 'video',
            displayType: DISPLAY_TYPES.USER_CAM,
            mediaConfig: {video: true},
            enabled
        });
    }

    async toogleDisplay(opts) {
        const { onended, enabled } = opts;
        const notify = {
            type: 'changedisplaystream',
            data: { mediaType: 'video' }
        };
        if(this.displayStream) {
            /** se o display esta setado significa a tela esta sendo compartilhada, entao o compartilhamento é parado e a stream é definida como nula para q na proxima execuçao o compartilhamento seja executado novamrnte */
            this.displayStream.getTracks().forEach(track => {
                track.stop();
                this.displayStream.removeTrack(track);
            });
            notify.data.stream = this.displayStream = null;
            this._notify(notify);
            return this.displayStream;
        }
        /** aqui ao inves de tentar reutiliza o stream é feita uma nova solicitaçao para o compartilhamento de tela */
        const stream = await this.getDisplayMedia();
        notify.data.stream = stream;
        stream.getVideoTracks()[0].onended = () => {
            notify.data.stream = this.displayStream = null;
            this._notify(notify);
            if(onended) {
                onended();
            }
        };
        if(!this.peer || this.peer.pc.getTransceivers().length === 0) {
            console.log('atuamente sem conexao ou sem nenhum transiver. A stream ainda sera retornada, mas nao anexada ao transiver');
            this._notify(notify);
            return stream;
        }
        const transceiver = this.peer.retriveTransceiver({ displayType: DISPLAY_TYPES.DISPLAY });
        stream.getVideoTracks()[0].onended = () => {
            transceiver.sender.replaceTrack(null);
            transceiver.direction = 'recvonly';
            notify.data.stream = this.displayStream = null;
            this._notify(notify);
            if(onended) {
                onended();
            }
        };
        transceiver.direction = "sendrecv";
        transceiver.sender.replaceTrack(stream.getVideoTracks()[0]);
        transceiver.sender.setStreams(stream);
        this._notify(notify);
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

    send(data={type:MESSAGE_TYPES.TEXT}) {
        if(!this.peer) {
            throw new Error('a conexao nao foi estabelecida');
        }
        if(!this.peer.channel || this.peer.channel.readyState !== 'open') {
            throw new Error('o canal de comunicacao nao foi aberto');
        }
        const { message, type } = data;
        const msg = this._addMessage(this.peer.name, this.peer.target, message, type);
        this.peer.send(JSON.stringify(msg));
    }
    
    receive(data) {
        if(!this.peer) {
            throw new Error('a conexao nao foi estabelecida');
        }
        const { message, type } = data;
        this._addMessage(this.peer.target, this.peer.name, message, type);
    }

    _addMessage(sender, receiver, content, type) { 
        const msg = new Message(sender, receiver, content, type);
        if(type !== MESSAGE_TYPES.CHUNK) {
            this.messages.push(msg); 
        }
        return msg;
    }

    _notify(data) {
        const content = Object.assign({name: this.name}, data);
        Object.values(this.observers).forEach(obs => obs(content));
    }
}

export default Connection;