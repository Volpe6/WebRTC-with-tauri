import { v4 as uuidv4 } from 'uuid';

/**
 * referencias:
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 * https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/perfect-negotiation/js/peer.js
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

    retriveAddTransceiver(opts) {
        const { id } = opts;
        let transceiver = this.transceiver[id];
        if(transceiver) {
            return transceiver;
        }
        return this.addTransceiver(opts);
    }

    addTransceiver(opts) {
        const { trackOrKind, transceiverConfig, id } = opts;

        const track = typeof trackOrKind === 'object'? trackOrKind : null;
        const kind = typeof trackOrKind === 'object'? trackOrKind.kind : trackOrKind;

        let transceiver = this.transceiver[id];
        if(transceiver) {
            throw new Error(`já existe transceiver para o id ${id}`);
        }
        transceiver = this.pc.getTransceivers().find(trv => {
            const receiverKind = trv.receiver.track.kind;
            if(receiverKind !== kind) {
                return false;
            }
            for (const trcv of Object.values(this.transceiver)) {
                //se ta na lista, entao nao pode ser esse
                if(trv.receiver.track.id === trcv.receiver.track.id) {
                    return false;
                }
            }
            return true;
        });
        if(transceiver) {
            if(track) {
                try {
                    transceiver.direction = "sendrecv";
                    transceiver.sender.replaceTrack(track);
                    transceiver.sender.setStreams(transceiverConfig.streams[0]);
                } catch (e) {
                    throw new Error(`replace track stream error: ${e.toString()}`);
                }
            }
            this.transceiver[id] = transceiver;
            return transceiver;
        }
        transceiver = this.pc.addTransceiver(trackOrKind, transceiverConfig);
        this.transceiver[id] = transceiver;
        return transceiver;
    }

    close() {
        try {
            if(this.channel) {
                this.channel.close();
            }
            this.pc.close();
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
        this.pc.oniceconnectionstatechange = null;
        this.pc.onicegatheringstatechange = null;
        this.pc.onsignalingstatechange = null;
        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.ondatachannel = null;
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
        if(!this.channel) {
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
        this.channel = event.channel;
        this.channel.onopen = (event) => this._onDataChannelOpen(event);
        this.channel.onclose = (event) => this._onDataChannelClose(event);
        this.channel.onmessage = (event) => this._onDataChannelMessage(event);
        this.channel.onerror = (event) => this._onDataChannelError(event);
    }

    _onDataChannelOpen(event) {
        this._notify({type: 'datachannelopen', data:event});
    }

    _onDataChannelClose(event) {
        this._notify({type: 'datachannelclose', data:event});
    }

    _onDataChannelMessage(event) {
        this._notify({type: 'datachannelmessage', data:event});
    }

    _onDataChannelError(event) {
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

export default Peer;