import {Account} from "../models/account";
import {RemindMethod} from "../models/notification_types";
import {BirthdaysList} from "../models/birthdays_list";
import {Birthday} from "../models/birthday";
import {MailService} from "@sendgrid/mail";
import {Twilio} from "twilio";
import functions from "firebase-functions";
import {messaging} from "firebase-admin";
import Message = messaging.Message;
import {
    AndroidConfig,
    ApnsConfig,
    FcmOptions,
    Notification,
    WebpushConfig
} from "firebase-admin/lib/messaging/messaging-api";


interface RemindJob {
    user: Account,
    method: string,
    birthdays: Array<Birthday>
}

interface ANotification {
    data: {
        type: string;
        title: string;
        body: string;
        badge: string;
        priority: number;
    },
    notification: {
        title: string;
        body: string;
    },
    token: string;
}

/// in charge of sending reminder messages to all users.
export class BirthdaysReminderMessenger {
    db: any;
    sgMail: MailService;

    smsClient: Twilio;
    twilioNumber: string;

    FCM: any;

    constructor(db: any, sgMail: MailService, smsClient: Twilio, twilioNumber: string, FCM: any) {
        this.db = db;
        this.sgMail = sgMail;
        this.smsClient = smsClient;
        this.twilioNumber = twilioNumber;
        this.FCM = FCM;
    }

    getMessage(job: RemindJob): string {
        if (job.birthdays.length === 1) {
            if (job.method == RemindMethod.sendEmail || job.method == RemindMethod.pushNotification) {
                return job.birthdays[0].messageEmail(job.user.name);
            } else {
                return job.birthdays[0].message(job.user.name);
            }

        } else {
            if (job.method == RemindMethod.sendEmail) {
                return this.mergeBirthdaysForEmail(job.birthdays);
            } else {
                return this.mergeBirthdaysInMessage(job.birthdays);
            }

        }
    }

    // used to send all SMS messages
    // user's phone must be valid
    // the job's method must be equal to email
    // if birthdays are more than one, it will merge them in one message reminder.
    sendSMS = async (job: RemindJob) => {

        functions.logger.log("Sending sms to :  " + job.user.id + "" + job.user.phoneNumber);
        if (job.method === RemindMethod.sendSMS && job.user.isValidE164Number) {

            await this.smsClient.messages.create({
                body: this.getMessage(job),
                to: job.user.phoneNumber,  // Text to this number
                from: this.twilioNumber // From a valid Twilio number
            });
            functions.logger.log("SMS sent to  " + job.user.id + " this number" + job.user.phoneNumber);
        }
    }


    /// used to generate SMS message that's sent when the user has more than one reminder that day.
    mergeBirthdaysInMessage(birthdays: Array<Birthday>) {

        return `\n
        ${birthdays.map((birthday) => {
            return `\n🎉${birthday.oneLineDetail()}\n`;
        }).join("\n")}
        `;
    }


    mergeBirthdaysForEmail(birthdays: Array<Birthday>) {
        return `
        🎉<br>
        ${birthdays.map((birthday) => {
            return `<br>🎉${birthday.oneLineDetail()}<br>`;
        }).join("\n")}
   
        `;
    }

    // used to send all email reminders
    // user's email must be verified
    // the job's method must be equal to email
    // if birthdays are more than one, it will merge them in one message reminder.
    sendEmail = async (job: RemindJob) => {


        if (job.method === RemindMethod.sendEmail && job.user.emailIsVerified) {

            const msg = {
                to: job.user.email,
                from: 'rodrielnt@gmail.com',
                subject: 'Reminder from Celebrated!',
                text: this.getMessage(job),
                html: this.emailMessageTemplate(job.user.name, this.getMessage(job)),
            };
            await this.sgMail.send(msg);
        }
    }

    emailMessageTemplate(name, message): string {
        return `
        <body style="text-align: center;font-family: sans-serif,aakar">
          <p style="color: white;text-align: center;padding: 23px">
            <img alt="" src="https://firebasestorage.googleapis.com/v0/b/celebrated-app.appspot.com/o/assets%2FIcon-192.png?alt=media&token=a61509f3-8114-41b1-91b9-f6637a9fe6ee" width="60px"><br>
          </p>
         <h3 style="font-size: 24px;font-family: sans-serif, 'Inter Semi Bold'">Hey ${name}, here are some birthdays to remember</h3>
         <p style="font-size: 18px;font-family: sans-serif, 'Inter Semi Bold'">${message.replace("\n", '<br>')}</p>
         <p style="text-align: center;">celebratedapp.com</p>
        </body>
    `;
    }

    // used to send all appPush Notification reminders
    // user's ID must be valid
    // the job's method must be equal to pushNotification
    // uses firebase cloud messaging
    // if birthdays are more than one, it will merge them in one message reminder.
    sendPushNotification = async (job: RemindJob) => {
        // push notification
        // This registration token comes from the client FCM SDKs.

        const registrationToken = job.user.deviceToken;
        let title: string = "a reminder";
        let message: string = this.getMessage(job);
        let imageUrl: string = "https://firebasestorage.googleapis.com/v0/b/celebrated-app.appspot.com/o/assets%2FIcon-192.png?alt=media&token=a61509f3-8114-41b1-91b9-f6637a9fe6ee";


        const notification: Message = {
            data: {
                type: 'reminder',
                title: title,
                body: message,
                badge: imageUrl,
                priority: 'normal',
            },
            notification: {
                title: "Birthday Reminder",
                body: message,
                imageUrl: imageUrl,
            },
            android: {
                priority: 'normal',
                ttl: 2000,
                restrictedPackageName: 'com.rodrickvy.celebrated',
                data: {
                    userName: job.user.name,
                },
                notification: {
                    title: title,
                    body: message,
                    icon: imageUrl,
                    color: '#FCC21B',

                }
            },
            webpush: {
                notification: {
                    title: title,
                    body: message,
                    icon: imageUrl,
                    color: '#FCC21B',
                }
            },
            token: registrationToken
        };

        functions.logger.log("Pushing to registration token: " + registrationToken + " Message :  " + message + "  Notification");
        await this.FCM.send(notification);
    }

    ///todo: service can know if message wasnt sent , and then tell clients app to let them know of erro, eg. verify thier phone number or email etc.


    // used to send all whatsapp Notification reminders
    // user's phone must be valid
    // the job's method must be equal to whatsapp
    // if birthdays are more than one, it will merge them in one message reminder.
    sendToWhatsapp = async (job: RemindJob) => {
        functions.logger.log("Sending whatsapp to :  " + job.user.id + "" + job.user.phoneNumber);
        if (job.method === RemindMethod.sendSMS && job.user.isValidE164Number) {

            await this.smsClient.messages.create({
                body: this.getMessage(job),
                to: `whatsapp:${job.user.phoneNumber}`,  // Text to this number
                from: `whatsapp:${this.twilioNumber}` // From a valid Twilio number
            });
            functions.logger.log("SMS sent to  " + job.user.id + " this number" + job.user.phoneNumber);
        }
    }

    // used to send all whatsapp Notification reminders
    // user's phone must be valid
    // the job's method must be equal to whatsappGroupReminder
    // if birthdays are more than one, it will merge them in one message reminder.
    sendToWhatsappGroup(job: RemindJob) {
        // sendToWhatsappGroup
    }


// scans for all  upcoming birthdays and users that need to be reminded
// and  returns a map linking each user in need of reminders, to the birthdays that are upcoming.
// This list is then used by the reminder to remind each user all upcoming birthdays at once.
// This is so that if a user has many birthdays upcoming they don't get separate messages.
    scanForRemindJobs2 = async (): Promise<Array<RemindJob>> => {

        const remindJobs = new Map<string, RemindJob>();
        // console.log("birthday-valid " + BirthdaysList.collectionRef);
        const docs = (await this.db.collection(BirthdaysList.collectionRef).get()).docs;
        functions.logger.log("Running reminder on  " + docs.length + " jobs");
        for (const doc of docs) {
            // const index = docs.indexOf(doc);
            const birthdayList = BirthdaysList.fromJson(doc.data());
            const author = await this.getUserAccountDetails(birthdayList.authorId);
            // console.log("birthday-valid "+JSON.stringify(doc.data()));
            //  console.log(`listIsValid:${birthdayList.isValid} accountIsValid: ${author.isValid}`);
            if (birthdayList.isDueForReminders && author.isValid) {
                console.log(birthdayList.notificationType);
                remindJobs.set(author.id, {user: author, birthdays: [], method: birthdayList.notificationType});
                birthdayList.birthdays.forEach((birthday: Birthday) => {
                    if (birthday.shouldSendReminder) {
                        let currentJob: RemindJob | undefined = remindJobs.get(author.id);
                        if (currentJob != undefined) {
                            currentJob.birthdays.push(birthday);
                            remindJobs.set(currentJob.user.id, currentJob);
                        }

                    }
                });

            }
            functions.logger.log("Loading docs " + doc.data()['id'] + "");
        }
        return Array.from(remindJobs.values());
    }

    scanForRemindJobs = async (): Promise<Array<RemindJob>> => {
        functions.logger.log("Scan has began");
        const watchers: Array<RemindJob> = [];

        const jobs: Array<Promise<RemindJob>> = (await this.db.collection(BirthdaysList.collectionRef).get()).docs
            .filter(async (doc) => {
                const birthdayList = BirthdaysList.fromJson(doc.data());
                const author = await this.getUserAccountDetails(birthdayList.authorId);
                return birthdayList.isDueForReminders && author.isValid;
            })
            .map(async (doc) => {
                const birthdayList = BirthdaysList.fromJson(doc.data());
                const author: Account = await this.getUserAccountDetails(birthdayList.authorId);
                const birthdaysToRemind: Array<Birthday> = birthdayList.birthdays
                    .filter((birthday: Birthday) => {
                        return birthday.shouldSendReminder(birthdayList.startReminding);
                    });
                const watchersJobs: Array<Promise<RemindJob>> = birthdayList.watchers.map(async (uid: string)=>{
                   return  await this.getUserAccountDetails(uid);
                }).filter(async  (account)=>(await  account).isValid).map(async  (watcher)=>{
                    const remindJob: RemindJob = {
                        user: (await  watcher),
                        birthdays: birthdaysToRemind,
                        method: birthdayList.notificationType
                    };

                    return remindJob;
                })
                watchers.push(...(await  Promise.all(watchersJobs)))
                const remindJob: RemindJob = {
                    user: author,
                    birthdays: birthdaysToRemind,
                    method: birthdayList.notificationType
                };
                return remindJob;

            });


        return [...(await Promise.all(jobs)),...watchers].filter((j) => j.birthdays.length >= 1);
    }
/// gets a map of user details --> birthdays to remind them and does
// the appropriate method of notification to the user.
// _functions.logger.log(JSON.stringify(birthday));
// _functions.logger.log(JSON.stringify(userObject));
    runRemindJobs = async (jobs: Array<RemindJob>) => {

        functions.logger.log("Running reminder on  " + jobs.length + " jobs");
        for (const job of jobs) {
            const index = jobs.indexOf(job);
            functions.logger.log("Running the job " + job.user.id + "");
            switch (job.method) {
                case  RemindMethod.sendSMS:
                    await this.sendSMS(job);
                    break;
                case  RemindMethod.sendEmail:
                    await this.sendEmail(job);
                    break;
                case  RemindMethod.sendWhatsapp:
                    await this.sendToWhatsapp(job);
                    break;
                case  RemindMethod.whatsappGroupReminder:
                    await this.sendToWhatsappGroup(job);
                    break;
                case  RemindMethod.pushNotification:
                    await this.sendPushNotification(job);
                    break;
            }

        }
        functions.logger.log("Completed function runRemindJobs");
    }


    getUserAccountDetails = async (uid: string): Promise<Account> => {

        try {
            // console.log(`data is good   ${uid !== undefined && uid.trim().length > 0}`);
            if (uid === undefined || uid.trim().length === 0) {
                return Account.empty();
            }
            const obj: any = (await this.db.collection(Account.collectionRef).doc(uid).get()).data();

            // console.log(JSON.stringify(obj) + " " + uid);
            if (obj != undefined) {
                return Account.fromJson(obj);
            }
            return Account.empty();
        } catch (e) {
            return Account.empty();
        }


    }


    /// runs all  the reminders
    static run = async (params: MessangerServiceParams) => {
        const messenger = new BirthdaysReminderMessenger(params.db, params.sgMail, params.smsClient, params.twilioNumber, params.FCM);
        return await messenger.runRemindJobs(await messenger.scanForRemindJobs());
    }

}


type MessangerServiceParams =
    {
        db: any;
        sgMail: MailService;
        smsClient: Twilio;
        twilioNumber: string;
        FCM: any;
    }
