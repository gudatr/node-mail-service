"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const uws_1 = require("uws");
const sendmail_1 = __importDefault(require("sendmail"));
const fs = __importStar(require("fs"));
class MailService {
    constructor(default_sender_name, default_sender_email, ssl = true, key_file_name = 'mail.key', cert_file_name = 'server.crt', debug = false, pass = '', dkim = 'dkim_private.pem', dkim_format = 'utf-8', key_selector = 'mails', maxPayload = 256 * 1024) {
        this.default_sender_name = default_sender_name;
        this.default_sender_email = default_sender_email;
        this.ssl = ssl;
        this.key_file_name = key_file_name;
        this.cert_file_name = cert_file_name;
        this.debug = debug;
        this.pass = pass;
        this.dkim = dkim;
        this.dkim_format = dkim_format;
        this.key_selector = key_selector;
        this.maxPayload = maxPayload;
        this.mailer = null;
    }
    listen(host, port) {
        if (this.ssl) {
            this.app = (0, uws_1.SSLApp)({
                key_file_name: this.key_file_name,
                cert_file_name: this.cert_file_name
            });
        }
        else {
            this.app = (0, uws_1.App)({});
        }
        this.app.post('/mail', (response, request) => {
            response.onAborted(() => response.ended = true);
            if (this.pass != '' && request.getQuery() !== this.pass) {
                response.writeStatus('401 Unauthorized');
                response.end('401 Unauthorized', true);
                return;
            }
            let body = Buffer.from('');
            response.onData(async (data, isLast) => {
                body = Buffer.concat([body, Buffer.from(data)]);
                if (body.length > this.maxPayload)
                    return response.end('Payload exceeded ' + this.maxPayload);
                if (isLast) {
                    try {
                        this.sendMail(response, JSON.parse(body.toString()));
                    }
                    catch (err) {
                        return response.end('Error parsing request: ' + err.message);
                    }
                }
            });
        });
        return new Promise((resolve, reject) => {
            this.app.listen(host, port, (listen_socket) => {
                if (listen_socket)
                    return resolve(true);
                reject(false);
            });
        });
    }
    sendMail(data, response = null) {
        try {
            this.mail(data.from ?? this.default_sender_email, data.sender ?? this.default_sender_name, data.to, data.replyTo, data.subject, data.html, data.text)
                .then(result => {
                if (response && !response.ended)
                    response.send(data.id ?? 0 + result);
            })
                .catch(err => {
                if (response && !response.ended)
                    response.send(data.id ?? 0 + err.message);
            });
        }
        catch (err) {
            if (response && !response.ended)
                response.send(err.message);
        }
    }
    async mail(from, sender, to, replyTo, subject, html, text) {
        return new Promise((resolve, reject) => {
            if (!this.mailer) {
                if (this.dkim) {
                    this.mailer = (0, sendmail_1.default)({
                        silent: this.debug,
                        dkim: {
                            privateKey: fs.readFileSync(this.dkim, this.dkim_format),
                            keySelector: this.key_selector
                        }
                    });
                }
                else {
                    this.mailer = (0, sendmail_1.default)({
                        silent: this.debug
                    });
                }
            }
            this.mailer({ from, sender, to, replyTo, subject, html, text }, (err, domain) => {
                if (err)
                    return reject(err);
                resolve(domain);
            });
        });
    }
}
exports.default = MailService;
