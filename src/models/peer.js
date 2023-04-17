import { v4 as uuidv4 } from 'uuid';

/**
 * referencias:
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 * https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/perfect-negotiation/js/peer.js
 */
class Peer {

    constructor() {
        this.config = {
            iceServers: [{urls: "stun:stun.stunprotocol.org"}]
        };

        this.observers = [];
        this.makingOffer = false;
        this.ignoreOffer = false;
        //https://stackoverflow.com/questions/73566978/how-to-define-polite-and-impolite-peer-in-perfect-negotiation-pattern
        this.polite = null;

        this.name = '';
        this.target = '';
        this.pc = new RTCPeerConnection(this.config);
        this.pc.ontrack = event => this._onTrack(event);
        this.pc.onicecandidate = event => this._onIceCandidate(event);
        this.pc.onconnectionstatechange = event => this._onConnectionStateChange(event);
        this.pc.oniceconnectionstatechange = event => this._onIceconnectionStateChange(event);
        this.pc.onnegotiationneeded = event => this._onNegotiationNeeded();
        this.pc.ondatachannel = null;

        this.channel = null;
        this.channelName = null;
        
        window.peer = this;
    }

    attachObserver(obs) { this.observers.push(obs); }

    detachAllObserver() { this.observers=[]; }

    addTransceiver(track, streams) {
        this.pc.addTransceiver(track, streams);
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
        this.channel.onmessage = null;
        this.channel.onopen = null;
        this.channel.onclose = null;
        this.channel.onerror = null;
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
    
    async createOffer() {
        this.pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        })
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
        this.observers.forEach(obs => obs(content));
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
}

export default Peer;