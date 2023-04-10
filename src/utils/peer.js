/**
 * referencias:
 * https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 * https://github.com/webrtc/samples/blob/gh-pages/src/content/peerconnection/perfect-negotiation/js/peer.js
 */
class Peer {

    constructor(polite) {
        this.config = {
            iceServers: [{urls: "stun:stun.stunprotocol.org"}]
        };

        this.observers = [];
        this.makingOffer = false;
        this.ignoreOffer = false;
        //https://stackoverflow.com/questions/73566978/how-to-define-polite-and-impolite-peer-in-perfect-negotiation-pattern
        this.polite = polite;

        this.name = 'teste';
        this.pc = new RTCPeerConnection(this.config);
        window.pc = this.pc;
        this.pc.ontrack = event => this._onTrack(event);
        this.pc.onicecandidate = event => this._onIceCandidate(event);
        this.pc.onconnectionstatechange = event => this._onConnectionStateChange(event);
        this.pc.oniceconnectionstatechange = event => this._onIceconnectionStateChange(event);
        this.pc.onnegotiationneeded = event => this._onNegotiationNeeded();
    }

    attachObserver(obs) { this.observers.push(obs); }

    detachAllObserver() { this.observers=[]; }

    close() {
        this.pc.close();
    }

    async addIceCandidate(candidate) {
        try {
            // console.log('adicionado ice candidato')
            await this.pc.addIceCandidate(candidate);
            this._notify({
                name: this.name,
                target: '',
                type: 'info',
                data: 'ice candidato adicionado'
            });
        } catch (error) {
            if (!this.ignoreOffer) {
                throw err;
            }
        }
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
                return;
            } 

            await this.pc.setRemoteDescription(description);
            if (description.type === "offer") {
                await this.pc.setLocalDescription();
                this._notify({
                    name: this.name,
                    target: '',
                    type: 'negotiation',
                    data: this.pc.localDescription
                });
            }
        } catch (err) {
            console.error(err);
        }
    }
    
    // async treatNegotiation(content) {
    //     const description  = content.data;
    //     console.log(content);
    //     try {
    //         // If we have a setRemoteDescription() answer operation pending, then
    //       // we will be "stable" by the time the next setRemoteDescription() is
    //       // executed, so we count this being stable when deciding whether to
    //       // ignore the offer.
    //       const isStable =
    //           this.pc.signalingState == 'stable' ||
    //           (this.pc.signalingState == 'have-local-offer' && this.srdAnswerPending);
    //       this.ignoreOffer =
    //           description.type == 'offer' && !this.polite && (this.makingOffer || !isStable);
    //       if (this.ignoreOffer) {
    //         console.log('glare - ignoring offer');
    //         return;
    //       }
    //       this.srdAnswerPending = description.type == 'answer';
    //       console.log(`SRD(${description.type})`);
    //       await this.pc.setRemoteDescription(description);
    //       console.log('remote description seteded')
    //       this.srdAnswerPending = false;
    //       if (description.type == 'offer') {
    //         console.log('SLD to get back to stable');
    //         await this.pc.setLocalDescription();
    //         console.log('definindo descricao local')
    //          this._notify({
    //             name: this.name,
    //             target: '',
    //             type: 'negotiation',
    //             data: this.pc.localDescription
    //         });
    //      }
    //     } catch (err) {
    //         console.error(err);
    //     }
    // }

    async createOffer() {
        this.pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
        })
        .then(offer => {
            this._notify({
                name: this.name,
                target: '',
                type: 'info',
                data: {
                    info: 'criada oferta',
                    data: offer
                }
            });
            return this.pc.setLocalDescription(offer);
        })
        .then(() => this._notify({
            name: this.name,
            target: '',
            type: 'negotiation',
            data: this.pc.localDescription
        }))
        .catch(error => this._notify({
            name: this.name,
            target: '',
            type: 'error',
            data: `Failed to create session description: ${error.toString()}`
        }));
    }

    _notify(data) {
        this.observers.forEach(obs => obs(data));
    }

    async _onNegotiationNeeded() {
        try {
            console.log('SLD due to negotiationneeded');
            this.makingOffer = true;
            await this.pc.setLocalDescription();
            this._notify({
                name: this.name,
                target: '',
                type: 'negotiation',
                data: this.pc.localDescription
            });
        } catch (error) {
            this._notify({
                name: this.name,
                target: '',
                type: 'error',
                data: `Failed to create session description: ${error.toString()}`
            });
        } finally {
            this.makingOffer = false;
        }
    }

    _onIceCandidate({candidate}) {
        if(candidate != null) {
            console.log('new ice candidate');
            this._notify({
                name: this.name,
                target: '',
                type: 'icecandidate',
                data: candidate
            });
            return;
        }
        console.log('all ice candidates obeteined');
    }

    _onTrack({track, streams}) {
        this._notify({
            name: this.name,
            target: '',
            type: 'track',
            data: {track, streams}
        });
    }

    _onIceconnectionStateChange(event) {
        if(this.pc.iceConnectionState) {
            this.pc.restartIce();
        }
        this._notify({
            name: this.name,
            target: '',
            type: 'iceconnectionstatechange',
            data: this.pc.iceConnectionState
        });
    }

    _onConnectionStateChange(event) {
        this._notify({
            name: this.name,
            target: '',
            type: 'connectionstatechange',
            data: this.pc.connectionState
        });
    }
}

export default Peer;