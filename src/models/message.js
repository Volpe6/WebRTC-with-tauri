const TYPES = {
    TEXT: 'text',
    VIDEO: 'video',
    IMAGE: 'image',
}

class Message {
    constructor(senderId, receiverId, message, type=TYPES.TEXT) {
        this.type = type;
        this.senderId = senderId;
        this.receiverId = receiverId;
        this.message = message;
        this.timestamp = new Date().getTime();
    }
}

export default Message;