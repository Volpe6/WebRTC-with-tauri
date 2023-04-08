import { useState, useEffect } from 'react';

const useWebRTC = (config) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);

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
    await peerConnection.setLocalDescription(offerDescription);

    return offerDescription;
  };

  const answer = async (offerDescription) => {
    await peerConnection.setRemoteDescription(offerDescription);

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

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
