import { io } from 'socket.io-client';

export const socket = io('http://webrtc-signaling-server.glitch.me/');