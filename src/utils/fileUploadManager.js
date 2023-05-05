import { v4 as uuidv4 } from 'uuid';
import { open } from '@tauri-apps/api/dialog';
import { readBinaryFile, writeBinaryFile, BaseDirectory } from '@tauri-apps/api/fs';
//https://github.com/tauri-apps/tauri/issues/996
import { metadata } from "tauri-plugin-fs-extra-api";
import { TYPES as MESSAGE_TYPES } from "../models/message";

const CHUNK_SIZE = 16384;

const MAX_BUFFER_AMOUNT = Math.max(CHUNK_SIZE * 8, 1048576); // 8 chunks or at least 1 MiB

class File {
    constructor(opts) {
        const { id, path, metaData, bufferedAmount } = opts;
        this.id = id;
        this.bufferedAmount = bufferedAmount;
        this.path = path;
        this.metaData = metaData;
        this.receivedSize = 0;
        this.observers = {};
        this.receiveBuffer = [];
    }

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

    _notify(data) {
        const content = Object.assign({}, data);
        Object.values(this.observers).forEach(obs => obs(content));
    }

    async receive(data) {
        const buffer = data.buffer;
        console.log(`${this.id} Received Message ${buffer.byteLength}`);
        this.receiveBuffer.push(buffer);
        this.receivedSize += buffer.byteLength;
        if(this.receivedSize === this.metaData.size) {
            const receivedFile = new Uint8Array(this.receivedSize);
            let offset = 0;
            this.receiveBuffer.forEach((buffer, i) => {
                receivedFile.set(buffer, offset);
                offset += CHUNK_SIZE;
            });
            writeBinaryFile("C:\\Users\\Andrew\\Downloads\\teste-tauri.rar", receivedFile)
            .then(() => console.log('arquivo escrito'))
            .catch(() => console.log('error ao salvar'))
            .finally(() => this._notify({type: 'end', data: {id:this.id}}));
        }
    }

    async send() {
        this._notify({type:"info", data: { id:this.id, metaData: this.metaData }});
        console.log('lendo')
        readBinaryFile(this.path)
        .then(contents => {
            console.log('terminou de ler')
            let offset = 0;
            let bufferedAmount = this.bufferedAmount;
            while(offset < this.metaData.size) {
                if(bufferedAmount >= MAX_BUFFER_AMOUNT) {
                    // Limpando a fila de envio com uma mensagem vazia
                   this._notify({type:"cleanqueue"});
                   bufferedAmount = this.bufferedAmount;
                   offset = this.metaData.size+1
                   continue;
                }
                const chunk = contents.slice(offset, offset + CHUNK_SIZE);
                console.log(`${this.id} send chunk`, chunk);
                this._notify({type:"chunk", data: {id:this.id, chunk}});
                bufferedAmount += CHUNK_SIZE;
                offset += CHUNK_SIZE;
            }
        })
        .catch(() => {
            console.log('erro no envio');
            this._notify({type:"error", data: {id:this.id}});
        })
        .finally(() => this._notify({type:"end", data: {id:this.id}}));
    }
}

class FileUploadManager {
    
    constructor() {
        if(FileUploadManager.instance) {
            return FileUploadManager.instance;
        }
        this.currFile = null;
        this.sendFileList = {};
        this.receiveFileList = {};
        this.conn = null;
        FileUploadManager.instance = this;
    }

    setConnection(conn) { this.conn = conn; }
    
    async choose() {
        const selected = await open();
        if(!selected) {
            console.log('usuario nao escolheu nada');
            return null;
        }
        const metaData = await metadata(selected);
        metaData.fileName = selected.substring(selected.lastIndexOf('\\') + 1);
        return this.currFile = { path: selected, metaData };
    }

    async receive(data) {
        if(!this.conn) {
            throw new Error('conexao nao foi setada');
        }
        const { type, message } = data;
        let file;
        switch(type) {
            case MESSAGE_TYPES.FILE_META:
                file = new File(message);
                this.receiveFileList[file.id] = file;
                file.attachObserver({ 
                    obs: async (content) => {
                        const strategy = {
                            end: content => {
                                const { id } = content.data;
                                delete this.sendFileList[id];
                            },
                        };
                        const chosenStrategy = strategy[content.type];
                        if(chosenStrategy) {
                            chosenStrategy(content);
                        }
                    }
                });
                break;
            case MESSAGE_TYPES.FILE:
                console.log('uploader');
                console.log(this);
                file = this.receiveFileList[message.id];
                file.receive(Uint8Array.from(message.chunk));
                break;
        }
        
    }

    async send() {
        if(!this.conn) {
            throw new Error('conexao nao foi setada');
        }
        if(!this.currFile) {
            throw new Error('nada a ser enviado');s
        }
        const file = new File({id:uuidv4(), path: this.currFile.path, metaData: this.currFile.metaData, bufferedAmount: this.conn.peer.channel.bufferedAmount});
        this.sendFileList[file.id] = file;
        this.currFile = null;
        file.attachObserver({
            obs: async (content) => {
                const strategy = {
                    end: content => {
                        console.log(content);
                        const { id } = content.data;
                        delete this.sendFileList[id];
                    },
                    cleanqueue: content => {
                        // Limpando a fila de envio com uma mensagem vazia
                        console.log('linpando fila')
                        this.conn.peer.send('');
                    },
                    info: content => {
                        this.conn.send({
                            type: MESSAGE_TYPES.FILE_META,
                            message: content.data
                        });
                    },
                    chunk: content => {
                        content.data.chunk = Array.from(content.data.chunk);
                        this.conn.send({
                            type: MESSAGE_TYPES.FILE,
                            message: content.data
                        });
                    },
                };
                const chosenStrategy = strategy[content.type];
                if(chosenStrategy) {
                    chosenStrategy(content);
                }
            }
        });
        file.send();
    }
}

export default FileUploadManager;