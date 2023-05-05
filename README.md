# WebRTC com tauri

Este projeto é uma implementação do WebRTC para conexão ponto a ponto entre dois computadores. Foi construído utilizando o framework Tauri, que é utilizado para a construção de aplicativos desktop com a utilização de JavaScript. Neste projeto específico, foi utilizado o Tauri juntamente com o Next.js.

WebRTC (Web Real-Time Communications) é uma tecnologia de comunicação em tempo real baseada em navegador, que permite a transferência de áudio, vídeo e dados diretamente entre navegadores sem a necessidade de plugins ou softwares adicionais. Para mais informações sobre WebRTC, consulte a documentação oficial da [MDN](https://developer.mozilla.org/pt-BR/docs/Web/API/WebRTC_API).

O projeto nao utiliza o servidor TURN, utiliza apenas um servidor STUN da google. 

## Começando

Atualmente o aplicativo so permite uma conexão por vez.

Para executar rode os seguintes comandos, aparecerá uma tela de aplicativo:

```bash
   #instala as dependencias do projeto na parte do js
   yarn install
   yarn dev
```

### Pré-requisitos

- tauri configurado [tauri](https://tauri.app/v1/guides/getting-started/prerequisites)

### Features

- [x] Conexão entre computadores em redes diferentes
- [x] Compartilhamento de camera
- [x] Compartilhamento de audio
- [x] Compartilhamento da tela
- [x] Chat
- [x] Compartilhamento de arquivos de até 10mb


## Licença

Este projeto é licenciado sob a Licença MIT. Consulte o arquivo [LICENSE](LICENSE) para obter detalhes.