
import {MailService} from "@sendgrid/mail";
import {Account} from "../models/account";
import {getUser, updateUser} from "../actions/get.user";
import * as crypto from "crypto";
import functions from "firebase-functions";


/// charge of sending reminder messages to all users.
export class EmailVerifier {
    db: any;
    sgMail: MailService;
    userId: string;
    auth:any;

    constructor(db:any,auth:any,  sgMail: MailService, userId: string) {
        this.db = db;
        this.sgMail = sgMail;
        this.userId = userId;
        this.auth = auth;
    }

    generateVerificationCode = (): string => {
        return crypto.randomBytes(20).toString('hex').substring(0, 4).toUpperCase();
    }


    async setCodeInDb(code: String) {
        await this.db.doc(`/codes/${this.userId}`).set({
            "emailVerification": code
        });
    }

    async getCodeInDb() {
        const data = (await this.db.doc(`/codes/${this.userId}`).get()).data();
        return data["emailVerification"];
    }

    async user(): Promise<Account> {
        return await getUser(this.userId, this.db);
    }

    async sendEmail(): Promise<SendVerificationEmailResponse> {

        try {
            functions.logger.log("Sending email ");
            const user: Account = await this.user();
            const code: string = this.generateVerificationCode();
            await this.setCodeInDb(code);
            functions.logger.log("email sent");
            const msg = {
                to: user.email,
                from: 'noreply@celebratedapp.com',
                subject: 'Verify your email',
                html: this.messageTemplate(user.name, code),
            };

            return this.sgMail.send(msg).then(async () => {
                    return {
                        success: true,
                        userId: this.userId,
                        sentTo: (await this.user()).email,
                        error: null
                    }
                }
            ).catch(async (error) => {
                return {
                    success: false,
                    userId: this.userId,
                    sentTo: (await this.user()).email,
                    error: error.toString()
                }
            })
        } catch (e) {

            return {
                success: false,
                userId: this.userId,
                sentTo: 'unkown',
                error: e.toString()
            }
        }


    }

    async verifyCode(code: string): Promise<EmailCodeVerificationResponse> {
        try {
            const codeInDb: string = await this.getCodeInDb();
            functions.logger.log("got code "+ codeInDb);
            if (codeInDb == code) {
                await updateUser(this.userId, this.db, {'emailVerified': true});
                await  this.auth.updateUser(this.userId, {emailVerified: true});
                return {
                    success: true,
                    userId: this.userId,
                    validCode: codeInDb == code,
                    sentTo: (await this.user()).email,
                    emailVerified: (await this.user()).emailIsVerified,
                    error: null
                }
            } else {
                return {
                    success: false,
                    userId: this.userId,
                    validCode: false,
                    sentTo: (await this.user()).email,
                    emailVerified: (await this.user()).emailIsVerified,
                    error: 'code-invalid-or-expired'
                }
            }
        } catch (e) {

            return {
                success: false,
                userId: this.userId,
                validCode: false,
                sentTo: 'unkown',
                emailVerified: false,
                error: e.toString()
            }
        }


    }


    messageTemplate = (name, verifyCode) => {
        return `
        <body style="text-align: center;font-family: sans-serif,aakar">
          <p style="color: white;text-align: center;padding: 23px">
            <img alt="" src="https://firebasestorage.googleapis.com/v0/b/celebrated-app.appspot.com/o/assets%2FIcon-192.png?alt=media&token=a61509f3-8114-41b1-91b9-f6637a9fe6ee" width="60px"><br>
          </p>
         <h3 style="font-size: 24px;font-family: sans-serif, 'Inter Semi Bold'">Hey ${name}, lets verify your email</h3>
         <p>Here is your email verification code. </p>
         <div  style="box-shadow: none;background: #FCC21B;border: none;padding: 18px;font-size: 18px;width: 50%;margin-left: auto;margin-right: auto" >${verifyCode}</div>
            <br>
         <p style="text-align: center;">www.celebratedapp.com</p>
        </body>
    `;
    }


    static sendVerificationCode = async (params: SendVerificationParams) => {
        const messenger = new EmailVerifier(params.db,params.auth, params.sgMail, params.userId);
        return await messenger.sendEmail();
    }
    static verifyEmailCode = async (params: CheckVerificationParams) => {
        const messenger = new EmailVerifier(params.db,params.auth, params.sgMail, params.userId);
        return await messenger.verifyCode(params.code);
    }


}


type SendVerificationParams = {
    db: any;
    sgMail: MailService;
    userId: string;
    auth:any
}
type SendVerificationEmailResponse =
    {
        success: boolean;
        userId: string;
        sentTo: string;
        error: string | null;
    }

type EmailCodeVerificationResponse =
    {
        success: boolean;
        userId: string;
        sentTo: string;
        emailVerified: boolean;
        validCode: boolean;
        error: string | null;
    }
type CheckVerificationParams = {
    db: any;
    sgMail: MailService;
    userId: string;
    code: string;
    auth: any
}
