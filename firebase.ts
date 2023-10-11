import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyAS_gZkizv_hSLyMqEgzGou_TGaOm1dtOw",
  authDomain: "chatapplication-with-cha-ed507.firebaseapp.com",
  projectId: "chatapplication-with-cha-ed507",
  storageBucket: "chatapplication-with-cha-ed507.appspot.com",
  messagingSenderId: "1068892901558",
  appId: "1:1068892901558:web:9c8339151abd6a9cb39617"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app)
export const auth = getAuth(app)