import functions from 'firebase-functions';
import {BirthdaysReminderMessenger} from "./services/reminders_service";
import admin from "firebase-admin";
import twilio, {Twilio} from "twilio";
import sgMail from "@sendgrid/mail";
import {EmailVerifier} from "./services/email_verification_service";

sgMail.setApiKey("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");
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
const fcm = admin.messaging();
const accountSid = 'ACe2d8211e712e5511f605b1eb0a899885'; //_functions.config().twilio.sid;
const authToken = '31f8b2f3a48ef90733033a6c96df34e9';// _functions.config().twilio.token;
const client = new twilio.Twilio(accountSid, authToken);

const twilioNumber = '+12267782306';
const runEvery12Hours = "0 */12 * * *";
const runEvery24Hours = "every minute";
const runEveryMinute = "* * * * *";



export const remindUsersSchedule = functions.pubsub.schedule("every 24 hours").onRun(async (context) => {
    return await BirthdaysReminderMessenger.run({
        db: db,
        sgMail: sgMail,
        smsClient: client,
        twilioNumber: twilioNumber,
        FCM:fcm
    });

});


export const sendEmailVerificationCode = functions.https.onCall(async (data, context) => {

    return await  EmailVerifier.sendVerificationCode({
        db: db,
        auth:auth,
        sgMail: sgMail,
        userId:context.auth.uid
    })


})




export const verifyEmailVerificationCode = functions.https.onCall(async (data, context) => {
    functions.logger.log("Data : "+data+"   code: "+data.code);
    return await  EmailVerifier.verifyEmailCode({
        db: db,
        auth:auth,
        sgMail: sgMail,
        userId:context.auth.uid,
        code:data.code
    })


})

