import {Account} from "../models/account";
import _firestore from "@google-cloud/firestore";
import {firestore} from "firebase-admin";


export const getUser = async (uid: string, db: _firestore.Firestore): Promise<Account> => {
    // console.log(`data is good   ${uid !== undefined && uid.trim().length > 0}`);
    if (uid === undefined || uid.trim().length === 0) {
        return Account.empty();
    }
    const obj: any = (await db.collection(Account.collectionRef).doc(uid).get()).data();

    // console.log(JSON.stringify(obj) + " " + uid);
    if (obj != undefined) {
        return Account.fromJson(obj);
    }
    return Account.empty();


}


export const updateUser = async (uid: string, db: _firestore.Firestore, updates:object): Promise<boolean> => {

    return db.collection(Account.collectionRef).doc(uid).update(updates).then((value) => true).catch(() => false);


}
