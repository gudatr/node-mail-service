import { SSLApp, App, TemplatedApp, WebSocket } from "uws";
import sendmail from 'sendmail';
import * as fs from "fs";

export default class MailService {

    app: TemplatedApp;
    mailer: SendMailFn | null = null;

    constructor(
        public default_sender_name: string,
        public default_sender_email: string,
        ssl = true,
        key_file_name: string = 'mail.key',
        cert_file_name: string = 'server.crt',
        public debug = false,
        public pass: string = '',
        public dkim: string | undefined = 'dkim_private.pem',
        public dkim_format: BufferEncoding = 'utf-8',
        public key_selector: string = 'mails',
        public maxPayload: number = 256 * 1024) {

        if (ssl) {
            this.app = SSLApp({
                key_file_name,
                cert_file_name
            });
        } else {
            this.app = App({});
        }

        let aborted = () => { };

        this.app.ws('/mail', {
            idleTimeout: 0,
            maxPayloadLength: maxPayload,
            message: (ws, message, isbinary) => { this.sendMail(ws, message, isbinary) },

            upgrade: (res, req, context) => {
                res.onAborted(aborted);

                if (this.pass !== '' && req.getQuery() !== this.pass) {
                    res.writeStatus('401 Unauthorized');
                    res.end('401 Unauthorized', true);
                    return;
                }

                res.upgrade({},
                    req.getHeader('sec-websocket-key'),
                    req.getHeader('sec-websocket-protocol'),
                    req.getHeader('sec-websocket-extensions'),
                    context);
            },
        });
    }

    listen(host: string, port: number): Promise<boolean> {
        return new Promise((resolve, reject) => {
            this.app.listen(host, port, (listen_socket) => {
                if (listen_socket) return resolve(true);
                reject(false);
            });
        });
    }

    sendMail(ws: WebSocket, message: ArrayBuffer, _isBinary: boolean) {
        try {
            let data = JSON.parse(Buffer.from(message).toString());
            this.mail(
                data.from ?? this.default_sender_email,
                data.sender ?? this.default_sender_name,
                data.to,
                data.replyTo,
                data.subject,
                data.html)
                .then(result => {
                    try { ws.send(data.id ?? 0 + result); } catch (err) { }
                })
                .catch(err => {
                    try { ws.send(data.id ?? 0 + err.message); } catch (err) { }
                });
        } catch (err: any) {
            try { ws.send(err.message ?? ''); } catch (err) { }
        }
    }

    async mail(from: string, sender: string, to: string, replyTo: string, subject: string, html: string) {
        return new Promise((resolve: (domain: string) => void, reject: (err: Error) => void) => {
            if (!this.mailer) {
                if (this.dkim) {
                    this.mailer = sendmail({
                        silent: this.debug,
                        dkim: {
                            privateKey: fs.readFileSync(this.dkim, this.dkim_format),
                            keySelector: this.key_selector
                        }
                    });
                } else {
                    this.mailer = sendmail({
                        silent: this.debug
                    });
                }
            }

            this.mailer({ from, sender, to, replyTo, subject, html }, (err, domain) => {
                if (err) return reject(err);
                resolve(domain);
            });
        })
    }
}

type SendMailFn = ((mail: sendmail.MailInput, callback: (err: Error, domain: string) => void) => void)