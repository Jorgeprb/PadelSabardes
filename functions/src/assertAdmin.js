const { HttpsError } = require("firebase-functions/v2/https");
const { db } = require("./firebase");

const assertAdmin = async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión para realizar esta acción.");
  }

  const callerSnapshot = await db.collection("users").doc(callerUid).get();
  if (!callerSnapshot.exists || callerSnapshot.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Solo un administrador puede realizar esta acción.");
  }

  return {
    uid: callerUid,
    profile: callerSnapshot.data(),
  };
};

module.exports = {
  assertAdmin,
};
