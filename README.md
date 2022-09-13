# Node Mail Service
A nodejs based websocket service you can relay sending out mails to


## Usage

Set up the mail service like so:

```javascript
let mailer = new MailService(
'Default Sender Name', 
'default@sender.mail',  
true,                  // Enable SSL, recommended
'mail.key',            // SSL key file, leave empty if not needed
'server.crt',          // SSL cert, leave empty if not needed
'passphrase',          // A passphrase for the webservice, leave empty if not needed
'dkim_private.pem',    // A DKIM private key used for verifing your server's sending rights
'utf-8',               // DKIM file encoding
'mailkey',             // The name of your DKIM selector in your DNS configuration
256 * 1024);           // Maximum payload size for one websocket message in bytes

await mailer.listen('0.0.0.0', 5000); //boolean, if listening was successful
````
Setting a passphrase is important but even better is to limit access to the service through ufw and such.


Now you can contact the service with:
```javascript
wss://theserversip:5000/mail?passphrase
```

It will expect messages in the following format:
```javascript
{            
            "from":     "noreply@sender.mail'",
            "sender":   "Sender Name",
            "to":       "mail@recipient.mail",
            "replyTo":  "answers@sender.mail",
            "subject":  "Subject",
            "html":     "HTML Content"
}
```

The replies will be very raw.
If you e.g. mess up the JSON you will get a parser error as response.
Otherwise you will get the receipient mail server response.
#### You can attach an "id" field to the message which will prefix the response.

## Trouble shooting

### 1. Receipient server could not verify your rights to send

Mail server reponse or similar:
```
Nemesis ESMTP Service not available
```

This most likely means the necessary PTR record is not setup or the RDNS service is not configured correctly.
You need to either configure a PTR record with your DNS or use the RDNS feature of your hosting service.
Both might sound scary but they break down to one line of configuration being:
```
server ip => domain name used
```
Reverse DNS as the name suggests so SMTP servers can check if you have a sending priviledge.

If the issue persists it COULD mean the RDNS does not respond quickly enough but I have not met with this fate yet.

### 2. Connection closed but mail not delivered

Mail server reponse:
```
221 <domain> Service closing transmission channel
```

This is what you would want normally. Everything was fine and the connection was closed.
If your mail was not delivered that probably means your server has a bad reputation or the mail content didnt pass a filter.

### 3. Error 5xx

If you stumble upon a 5xx error that could be caused by the service itself, please open an issue with the steps to reproduce it.

### 4. Other

Otherwise you have to resort to checking the error on google as smtp servers are very strange beasts with each one being not like another.
Error codes are standardized but the acceptance of parameters, hidden reputation systems and required headers can vary.
