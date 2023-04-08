import { useState, useEffect } from 'react';

const useWebRTC = (config) => {
  
  const { name } = config;
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection1, setPeerConnection1] = useState(null);
  const [peerConnection2, setPeerConnection2] = useState(null);

  
  const initPeerConnection = async () => {
    const { iceServers } = config;
    const pc1 = new RTCPeerConnection({});
    const pc2 = new RTCPeerConnection({});
    setPeerConnection1(pc1);
    setPeerConnection2(pc2);

    pc1.onicecandidate = ({candidate}) => {
      try {
        pc1.addIceCandidate(candidate);
        console.log(`pc1 success to add ICE Candidate`);
      } catch (error) {
        console.log(`pc1 failed to add ICE Candidate: ${error.toString()}`);
      }
    }
    pc2.onicecandidate = ({candidate}) => {
      try {
        pc2.addIceCandidate(candidate);
        console.log(`pc2 success to add ICE Candidate`);
      } catch (error) {
        console.log(`pc2 failed to add ICE Candidate: ${error.toString()}`);
      }
    }
    pc1.oniceconnectionstatechange = (event) => {
      if (pc1) {
        console.log(`pc1 ICE state: ${pc1.iceConnectionState}`);
        console.log('ICE state change event: ', event);
      }
    }
    pc2.oniceconnectionstatechange = (event) => {
      if (pc2) {
        console.log(`pc2 ICE state: ${pc2.iceConnectionState}`);
        console.log('ICE state change event: ', event);
      }
    }
    pc2.ontrack = ({ streams: [stream] }) => {
      console.log('ontrack', stream);
      setRemoteStream(stream);
      remoteVideoRef.current.srcObject = stream;
    }

    localStream.getTracks().forEach(track => pc1.addTrack(track, localStream));
    console.log('Added local stream to pc1');
    
     try {
      console.log('pc1 createOffer start');
      const offer = await pc1.createOffer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1
      });
      console.log('pc1 setLocalDescription start');
      try {
        await pc1.setLocalDescription(offer);
        console.log(`pc1 setLocalDescription complete`);
      } catch (e) {
        console.log(`pc1 Failed to set session description: ${e.toString()}`);
      }
      console.log('pc2 setRemoteDescription start');
      try {
        await pc2.setRemoteDescription(offer);
        console.log(`pc2 setRemoteDescription complete`);
      } catch (e) {
        console.log(`pc2 Failed to set session description: ${e.toString()}`);
      }
      console.log('pc2 createAnswer start');
      try {
        const answer = await pc2.createAnswer();
        await onCreateAnswerSuccess(answer);
        console.log('pc2 setLocalDescription start');
        try {
          await pc2.setLocalDescription(answer);
          console.log(`pc2 setLocalDescription complete`);
        } catch (e) {
          console.log(`pc2 Failed to set session description: ${e.toString()}`);
        }
        console.log('pc1 setRemoteDescription start');
        try {
          await pc1.setRemoteDescription(answer);
          console.log(`pc1 setRemoteDescription complete`);
        } catch (e) {
          console.log(`pc2 Failed to set session description: ${e.toString()}`);
        }
      } catch (e) {
        console.log(`Failed to create session description: ${e.toString()}`);
      }
    } catch (e) {
      console.log(`Failed to create session description: ${e.toString()}`);
    }
  }
  
  const addTrack = (track, stream) => {
    peerConnection.addTrack(track, stream); 
  }


  useEffect(() => {
    const initWebRTC = async () => {
      const { iceServers, mediaConstraints } = config;

      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      setLocalStream(stream);

      const pc = new RTCPeerConnection({ iceServers });

      pc.addTrack(stream.getTracks()[0], stream);
      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      setPeerConnection(pc);
    };

    initWebRTC();

    return () => {
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }
      if (localStream) {
        localStream.getTracks().forEach((track) => {
          track.stop();
        });
        setLocalStream(null);
      }
      if (remoteStream) {
        setRemoteStream(null);
      }
    };
  }, []);

  const offer = async () => {
    const offerDescription = await peerConnection.createOffer();
    console.log(`Offer from ${name} \n${offerDescription.sdp}`)
    console.log(`${name} setLocalDescription start`);
    try {
        await peerConnection.setLocalDescription(offerDescription);
        console.log(`${name} setLocalDescription complete`);
    } catch (e) {
        console.log(`Failed to set session description: ${e.toString()}`);
    }

    return offerDescription;
  };

  const answer = async (offerDescription) => {
    console.log(`${name} setRemoteDescription start`);
    let answerDescription;
    try {
        await peerConnection.setRemoteDescription(offerDescription);

        answerDescription = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answerDescription);
        console.log(`${name} setRemoteDescription complete`);
    } catch (e) {
        console.log(`Failed to set session description: ${e.toString()}`);
    }

    return answerDescription;
  };

  const setRemoteDescription = async (description) => {
    await peerConnection.setRemoteDescription(description);
  };

  const addIceCandidate = async (candidate) => {
    await peerConnection.addIceCandidate(candidate);
  };

  return {
    localStream,
    remoteStream,
    offer,
    answer,
    setRemoteDescription,
    addIceCandidate,
  };
};

export default useWebRTC;
