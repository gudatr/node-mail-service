/// <reference types="node" />
import { TemplatedApp, WebSocket } from "uws";
import sendmail from 'sendmail';
export default class MailService {
    default_sender_name: string;
    default_sender_email: string;
    debug: boolean;
    pass: string;
    dkim: string | undefined;
    dkim_format: BufferEncoding;
    key_selector: string;
    maxPayload: number;
    app: TemplatedApp;
    mailer: SendMailFn | null;
    constructor(default_sender_name: string, default_sender_email: string, ssl?: boolean, key_file_name?: string, cert_file_name?: string, debug?: boolean, pass?: string, dkim?: string | undefined, dkim_format?: BufferEncoding, key_selector?: string, maxPayload?: number);
    listen(host: string, port: number): Promise<boolean>;
    sendMail(ws: WebSocket, message: ArrayBuffer, _isBinary: boolean): void;
    mail(from: string, sender: string, to: string, replyTo: string, subject: string, html: string, text: string | undefined): Promise<string>;
}
declare type SendMailFn = ((mail: sendmail.MailInput, callback: (err: Error, domain: string) => void) => void);
export {};
