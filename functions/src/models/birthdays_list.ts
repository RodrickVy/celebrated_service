import {Birthday} from "./birthday";
import {RemindMethod} from "./notification_types";
import functions from "firebase-functions";

interface ListJson {
    birthdays: Array<any>,
    notificationType: string,
    authorId: string,
    name: string,
    startReminding: number
    watchers:Array<string>
}
export class BirthdaysList {
    name: string;
    birthdays: Array<Birthday>;
    authorId: string;
    watchers: Array<any>;
    notificationType: string;
    startReminding: number;

    constructor(
        name: string,
        birthdays: Array<Birthday>,
        authorId: string,
        watchers: Array<any>,
        notificationType: string,
        startReminding: number,) {
        this.name = name;
        this.birthdays = birthdays;
        this.authorId = authorId;
        this.watchers = watchers;
        this.notificationType = notificationType;
        this.startReminding = startReminding;
    }


    static fromJson(listJson: ListJson | any) {
        if (this.isValidObject(listJson)) {
            const birthdaysInList: Array<Birthday> = Array.from(listJson["birthdays"]).map((birthday: any) => {

                return new Birthday(birthday["name"], new Date(birthday['date']));
            });
             let notificationType = listJson["notificationType"];
            let startReminding = listJson["startReminding"];
            if(notificationType == undefined){
                notificationType = RemindMethod.sendSMS;
            }
            if(startReminding == undefined){
                startReminding = 3;
            }
            return new BirthdaysList(listJson["name"], birthdaysInList, listJson["authorId"], listJson["watchers"], notificationType, startReminding);
        } else {
            return new BirthdaysList("", [], '', [], '', 0);
        }

    }


    static isValidObject(listJson: ListJson) {
        return listJson["birthdays"] !== undefined && listJson["authorId"] !== undefined;
    }


    get isDueForReminders() {

        const isValid:boolean = this.authorId !== undefined && this.authorId.length !== 0 && this.birthdays.length !== 0;

        const needReminding = this.birthdays.filter((birthday:Birthday)=> birthday.shouldSendReminder(this.startReminding));

        return  isValid && needReminding.length >= 1;
    }


    static collectionRef = 'lists';
}
