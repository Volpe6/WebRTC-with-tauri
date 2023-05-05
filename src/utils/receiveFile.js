
import { readBinaryFile, writeBinaryFile, BaseDirectory } from '@tauri-apps/api/fs';

onmessage = function(e) {
    const data = e.data;
    console.log(data);
}