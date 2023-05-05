export const TYPES = {
    TEXT: 'text',
    CHUNK: 'chunk',
    FILE_META: 'fileMeta'//informaçoes sobre o arquivo enviado(tamanho, nome....)
};

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