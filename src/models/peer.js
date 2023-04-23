import { v4 as uuidv4 } from 'uuid';

/**
 * referencias:
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 * https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/perfect-negotiation/js/peer.js
 * https://blog.mozilla.org/webrtc/rtcrtptransceiver-explored/
 */
class Peer {

    constructor(polite=null) {
        this.config = {
            iceServers: [{urls: "stun:stun.stunprotocol.org"}]
        };

        this.observers = {};
        this.transceiver = {};
        this.makingOffer = false;
        this.ignoreOffer = false;
         /**
         * indica que essa conexao foi fechada. Se essa variavel estiver falsa e o peer estiver desconectado, pode ter havido um erro de conexão ou um fluxo mal tratado
         */
        this.closed = false;
        //https://stackoverflow.com/questions/73566978/how-to-define-polite-and-impolite-peer-in-perfect-negotiation-pattern
        this.polite = polite;

        this.name = '';
        this.target = '';
        this.pc = new RTCPeerConnection(this.config);
        this.pc.ontrack = event => this._onTrack(event);
        this.pc.onicecandidate = event => this._onIceCandidate(event);
        this.pc.onconnectionstatechange = event => this._onConnectionStateChange(event);
        this.pc.oniceconnectionstatechange = event => this._onIceconnectionStateChange(event);
        this.pc.onnegotiationneeded = event => this._onNegotiationNeeded();
        this.pc.onsignalingstatechange = event => this._onSignalingStateChange(event);
        this.pc.ondatachannel = null;

        this.channel = null;
        this.channelName = null;
        
        window.peer = this;
    }

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
    
    retriveTransceiver(opts) {
        const { displayType } = opts;
        return this.pc.getTransceivers()[displayType];
    }

    addTransceiver(opts) {
        const { trackOrKind, transceiverConfig } = opts;
        this.pc.addTransceiver(trackOrKind, transceiverConfig);
    }

    close() {
        try {
            if(this.channel && (this.channel.readyState !== 'closed' && this.channel.readyState !== 'closing')) {
                this.channel.close();
            }
            if(this.pc) {
                this.pc.close();
            }
        } catch (error) {
            this._notify({
                type: 'error',
                data: `Failed to close: ${error.toString()}`
            });
            return;
        }
        if(this.channel) {
            this.channel.onmessage = null;
            this.channel.onopen = null;
            this.channel.onclose = null;
            this.channel.onerror = null;
        }
        if(this.pc) {
            this.pc.oniceconnectionstatechange = null;
            this.pc.onicegatheringstatechange = null;
            this.pc.onsignalingstatechange = null;
            this.pc.onicecandidate = null;
            this.pc.ontrack = null;
            this.pc.ondatachannel = null;
        }
        this.channel = null;
        this.pc = null;
        this._notify({type: 'close'});
    }

    async addIceCandidate(candidate) {
        try {
            // console.log('adicionado ice candidato')
            await this.pc.addIceCandidate(candidate);
            this._notify({
                type: 'info',
                data: 'ice candidato adicionado'
            });
        } catch (error) {
            if (!this.ignoreOffer) {
                throw error;
            }
        }
    }

    send(data) {
        if(this.channel && this.channel.readyState === 'connecting') {
            console.log('conexão nao esta aberta');
            return;
        }
        if(!this.channel || (this.channel.readyState === 'closed' || this.channel.readyState === 'closing')) {
            console.log("Conexão fechada");
            return;
        }
        this.channel.send(data);
    }

    async treatNegotiation(content) {
        const description  = content.data;
        console.log(content);
        try {
            const offerCollision =
                description.type === "offer" &&
                (this.makingOffer || this.pc.signalingState !== "stable");

            
            this.ignoreOffer = !this.polite && offerCollision;
            if (this.ignoreOffer) {
                console.log('ignorou a oferta');
                this.pc.ondatachannel = event => this._onReceiveDataChannel(event);
                this._notify({
                    type: 'negotiation',
                    data: this.pc.localDescription
                });
                return;
            } 

            await this.pc.setRemoteDescription(description);
            if (description.type === "offer") {
                // se ta recebendo uma oferta, significa q deve retornar uma resposta, essa resposta é fornecida no codigo abaixo
                await this.pc.setLocalDescription();
                this._notify({
                    type: 'negotiation',
                    data: this.pc.localDescription
                });
            }
            if(this.polite) {
                this._createDataChannel();
            }else {
                this.pc.ondatachannel = event => this._onReceiveDataChannel(event);
            }
        } catch (err) {
            console.error(err);
        }
    }
    
    async createOffer(opts={}) {
        this.pc.createOffer(opts)
        .then(offer => {
            this._notify({
                type: 'info',
                data: {
                    info: 'criada oferta',
                    data: offer
                }
            });
            return this.pc.setLocalDescription(offer);
        })
        .then(() => this._notify({
            type: 'negotiation',
            data: this.pc.localDescription
        }))
        .catch(error => this._notify({
            type: 'error',
            data: `Failed to create session description: ${error.toString()}`
        }));
    }

    _notify(data) {
        const content = Object.assign({name: this.name, target: this.target}, data);
        Object.values(this.observers).forEach(obs => obs(content));
    }

    _createDataChannel() {
        if(!this.pc) {
            throw new Error('peer RTCConnection nao criada');
        }
        this.channelName = uuidv4();
        this.channel = this.pc.createDataChannel(this.channelName);
        this.channel.onopen = (event) => this._onDataChannelOpen(event);
        this.channel.onclose = (event) => this._onDataChannelClose(event);
        this.channel.onmessage = (event) => this._onDataChannelMessage(event);
        this.channel.onerror = (event) => this._onDataChannelError(event);
    }

    _onReceiveDataChannel(event) {
        if(this.channel && (this.channel.readyState === 'closed' || this.channel.readyState === 'closing')) {
            throw new Error('canal fechado');
        }
        this.channel = event.channel;
        this.channel.onopen = (event) => this._onDataChannelOpen(event);
        this.channel.onclose = (event) => this._onDataChannelClose(event);
        this.channel.onmessage = (event) => this._onDataChannelMessage(event);
        this.channel.onerror = (event) => this._onDataChannelError(event);
    }

    _onDataChannelOpen(event) {
        console.log('channel open');
        this._notify({type: 'datachannelopen', data:event});
    }

    _onDataChannelClose(event) {
        this._notify({type: 'datachannelclose', data:event});
    }

    _onDataChannelMessage(event) {
        console.log('channel message');
        this._notify({type: 'datachannelmessage', data:event});
    }

    _onDataChannelError(event) {
        console.log('channel error');
        this._notify({type: 'datachannelerror', data:event});
    }

    async _onNegotiationNeeded() {
        try {
            console.log('SLD due to negotiationneeded');
            this.makingOffer = true;
            await this.pc.setLocalDescription();
            this._notify({
                type: 'negotiation',
                data: this.pc.localDescription
            });
        } catch (error) {
            this._notify({
                type: 'error',
                data: `Failed to create session description: ${error.toString()}`
            });
        } finally {
            this.makingOffer = false;
        }
    }

    _onIceCandidate({candidate}) {
        if(candidate != null) {
            // console.log('new ice candidate');
            this._notify({
                type: 'icecandidate',
                data: candidate
            });
            return;
        }
        console.log('all ice candidates obeteined');
    }

    _onTrack(event) {
        this._notify({
            type: 'track',
            data: event
        });
    }

    _onIceconnectionStateChange(event) {
        if(this.pc.iceConnectionState === "failed") {
            this.pc.restartIce();
        }
        this._notify({
            type: 'iceconnectionstatechange',
            data: this.pc.iceConnectionState
        });
    }

    _onConnectionStateChange(event) {
        this._notify({
            type: 'connectionstatechange',
            data: this.pc.connectionState
        });
    }

    _onSignalingStateChange(event) {
        this._notify({
            type: 'signalingstatechange',
            data: this.pc.signalingState 
        });
    }
}

//os transiveirs sao adicionados de modo determinista entao caso sua ordem de adiçao seja modificada, aqui deve ser ajustado

export const DISPLAY_TYPES = {
    USER_AUDIO: 0,
    USER_CAM: 1,
    DISPLAY: 2
};

export default Peer;