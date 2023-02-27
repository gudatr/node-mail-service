import { SSLApp, App, TemplatedApp, HttpResponse } from "uws";
import sendmail from 'sendmail';
import * as fs from "fs";

export default class MailService {

    app: TemplatedApp;
    mailer: SendMailFn | null = null;
    private_key: string;

    constructor(
        public default_sender_name: string,
        public default_sender_email: string,
        public ssl = true,
        public key_file_name: string = 'mail.key',
        public cert_file_name: string = 'server.crt',
        public silent = true,
        public pass: string = '',
        public dkim: string | undefined = 'dkim_private.pem',
        public dkim_format: BufferEncoding = 'utf-8',
        public key_selector: string = 'mails',
        public maxPayload: number = 256 * 1024) {
    }

    listen(host: string, port: number): Promise<boolean> {
        if (this.ssl) {
            this.app = SSLApp({
                key_file_name: this.key_file_name,
                cert_file_name: this.cert_file_name
            });
        } else {
            this.app = App({});
        }

        this.app.post('/mail', (response, request) => {

            response.onAborted(() => response.ended = true);

            if (this.pass != '' && request.getQuery() !== this.pass) {
                response.writeStatus('401 Unauthorized');
                response.end('401 Unauthorized', true);
                return;
            }

            let body = Buffer.from('');
            response.onData(async (data: ArrayBuffer, isLast: boolean) => {
                body = Buffer.concat([body, Buffer.from(data)]);

                if (body.length > this.maxPayload) return response.end('Payload exceeded ' + this.maxPayload);

                if (isLast) {
                    try {
                        this.sendMail(response, JSON.parse(body.toString()));
                    } catch (err) {
                        return response.end('Error parsing request: ' + err.message);
                    }
                }
            });
        });

        return new Promise((resolve, reject) => {
            this.app.listen(host, port, (listen_socket) => {
                if (listen_socket) return resolve(true);
                reject(false);
            });
        });
    }

    sendMail(data: any, response: HttpResponse | null = null) {
        try {
            this.mail(
                data.from ?? this.default_sender_email,
                data.sender ?? this.default_sender_name,
                data.to,
                data.replyTo,
                data.subject,
                data.html,
                data.text)
                .then(result => {
                    if (response && !response.ended) response.send(data.id ?? 0 + result);
                })
                .catch(err => {
                    if (response && !response.ended) response.send(data.id ?? 0 + err.message);
                });
        } catch (err: any) {
            if (response && !response.ended) response.send(err.message);
        }
    }

    async mail(from: string, sender: string, to: string, replyTo: string, subject: string, html: string, text: string | undefined) {
        return new Promise((resolve: (domain: string) => void, reject: (err: Error) => void) => {
            if (!this.mailer) {
                if (this.dkim) {
                    this.mailer = sendmail({
                        silent: this.silent,
                        dkim: {
                            privateKey: fs.readFileSync(this.dkim, this.dkim_format),
                            keySelector: this.key_selector
                        }
                    });
                } else {
                    this.mailer = sendmail({
                        silent: this.silent
                    });
                }
            }

            this.mailer({ from, sender, to, replyTo, subject, html, text }, (err, domain) => {
                if (err) return reject(err);
                resolve(domain);
            });
        })
    }
}

type SendMailFn = ((mail: sendmail.MailInput, callback: (err: Error, domain: string) => void) => void)