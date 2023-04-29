import { v4 as uuidv4 } from 'uuid';
import { readBinaryFile, writeBinaryFile, BaseDirectory } from '@tauri-apps/api/fs';
//https://github.com/tauri-apps/tauri/issues/996
const CHUNK_SIZE = 26624;

const MAX_BUFFER_AMOUNT = Math.max(CHUNK_SIZE * 8, 5242880); // 8 chunks or at least 5 MiB
const MAX_FILE_SIZE = 36986880;

class FileUpload {
    constructor(opts) {
        const { id, path, metaData, connection } = opts;
        this.id = id;
        if(!id) {
            this.id = uuidv4();
        }
        this.connection = connection;
        this.path = path;
        this.metaData = metaData;
        this.receivedSize = 0;
        this.observers = {};
        this.receiveBuffer = [];

        this.currentOffset = 0;
        this.stopped = false;
        this.cancel = false;
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
        console.log(`recebido:`, (this.receivedSize*100)/this.metaData.size)
        if(this.receivedSize === this.metaData.size) {
            console.log('escrevendo arquivo');
            const mergedBuffer = this.receiveBuffer.reduce((accumulator, currentValue) => {
                const tmp = new Uint8Array(accumulator.byteLength+currentValue.byteLength);
                tmp.set(new Uint8Array(accumulator), 0);
                tmp.set(new Uint8Array(currentValue), accumulator.byteLength);
                return tmp.buffer;
            });
            const receivedFile = new Uint8Array(mergedBuffer);
            writeBinaryFile(`tauri-${this.metaData.fileName}`, receivedFile, { dir: BaseDirectory.Download })
            .then(() => console.log('arquivo escrito'))
            .catch(() => console.log('error ao salvar'))
            .finally(() => this._notify({type: 'end', data: {id:this.id}}));
        }
    }
    
    //talvez mover esse codigo para o peer
    // send(e){
    //     var chunkSize = 65535
    //     while (e.byteLength) {
    //         if (this._channel.bufferedAmount > this._channel.bufferedAmountLowThreshold) {
    //         this._channel.onbufferedamountlow = () => {
    //             this._channel.onbufferedamountlow = null;
    //             this.send(e);
    //         };
    //         return;
    //         }
    //         const chunk = e.slice(0, chunkSize);
    //         e = e.slice(chunkSize, e.byteLength);
    //         this._channel.send(chunk);
    // }

    async send() {
        if(this.metaData.size > MAX_FILE_SIZE){
            alert(`Tamanho máximo permitido ${MAX_FILE_SIZE}, tamanho do arquivo ${this.metaData.size}`);
            return;
        }
        if(!this.connection) {
            throw new Error('a conexao nao foi definida');
        }
        this._notify({type:"info", data: { id:this.id, metaData: this.metaData }});
        console.log('lendo')
        readBinaryFile(this.path)
        .then(async contents => {
            console.log('terminou de ler')
            let offset = 0;
            this.connection.peer.channel.bufferedAmountLowThreshold = MAX_BUFFER_AMOUNT;
            while(offset < this.metaData.size && !this.cancel) {
                console.log('entrou while');
                if(this.connection.peer.channel.bufferedAmount > this.connection.peer.channel.bufferedAmountLowThreshold) {
                    // Limpando a fila de envio com uma mensagem vazia
                   this.stopped = true;
                   this._notify({type:"cleanqueue"});
                   await new Promise(resolve => setTimeout(resolve, 1000));
                   continue;
                }
                this.stopped = false;
                const chunk = contents.slice(offset, offset + CHUNK_SIZE);
                console.log(`${this.id} send chunk`, chunk);
                this._notify({type:"chunk", data: {id:this.id, chunk}});
                offset += CHUNK_SIZE;
                console.log(`enviado:`, (offset*100)/this.metaData.size);
            }
        })
        .catch(() => {
            console.log('erro no envio');
            this._notify({type:"error", data: {id:this.id}});
        })
        .finally(() => this._notify({type:"end", data: {id:this.id}}));
    }
}

export default FileUpload;