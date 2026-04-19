const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { assertAdmin } = require("./assertAdmin");
const { auth, db, FieldValue } = require("./firebase");

const REGION = process.env.FUNCTIONS_REGION || "us-central1";

const commitBatches = async (operations) => {
  if (operations.length === 0) return;

  const chunks = [];
  for (let index = 0; index < operations.length; index += 400) {
    chunks.push(operations.slice(index, index + 400));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((operation) => {
      if (operation.type === "update") {
        batch.update(operation.ref, operation.data);
      } else if (operation.type === "delete") {
        batch.delete(operation.ref);
      } else if (operation.type === "set") {
        batch.set(operation.ref, operation.data, operation.options || {});
      }
    });
    await batch.commit();
  }
};

const deleteUserAsAdmin = onCall({ region: REGION }, async (request) => {
  const adminUser = await assertAdmin(request);
  const targetUid = typeof request.data?.targetUid === "string" ? request.data.targetUid.trim() : "";

  if (!targetUid) {
    throw new HttpsError("invalid-argument", "Debes indicar el usuario a eliminar.");
  }

  const userRef = db.collection("users").doc(targetUid);
  const deletedUserRef = db.collection("deletedUsers").doc(targetUid);

  const [matchesSnapshot, groupsSnapshot, teamsSnapshot] = await Promise.all([
    db.collection("matches").get(),
    db.collection("groups").where("userIds", "array-contains", targetUid).get(),
    db.collection("tournamentTeams").get(),
  ]);

  const operations = [
    {
      type: "set",
      ref: deletedUserRef,
      data: {
        deletedAt: new Date().toISOString(),
        deletedBy: adminUser.uid,
      },
      options: { merge: true },
    },
  ];

  matchesSnapshot.forEach((matchDoc) => {
    const data = matchDoc.data() || {};
    const updates = {};

    if (Array.isArray(data.listaParticipantes) && data.listaParticipantes.includes(targetUid)) {
      updates.listaParticipantes = FieldValue.arrayRemove(targetUid);
    }
    if (Array.isArray(data.listaInvitados) && data.listaInvitados.includes(targetUid)) {
      updates.listaInvitados = FieldValue.arrayRemove(targetUid);
    }

    if (Object.keys(updates).length > 0) {
      operations.push({
        type: "update",
        ref: matchDoc.ref,
        data: updates,
      });
    }
  });

  groupsSnapshot.forEach((groupDoc) => {
    operations.push({
      type: "update",
      ref: groupDoc.ref,
      data: {
        userIds: FieldValue.arrayRemove(targetUid),
      },
    });
  });

  teamsSnapshot.forEach((teamDoc) => {
    const data = teamDoc.data() || {};
    if (data.player1Id === targetUid || data.player2Id === targetUid) {
      operations.push({
        type: "delete",
        ref: teamDoc.ref,
      });
    }
  });

  operations.push({
    type: "delete",
    ref: userRef,
  });

  await commitBatches(operations);

  try {
    await auth.deleteUser(targetUid);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw new HttpsError("internal", error?.message || "No se pudo eliminar el usuario de Authentication.");
    }
  }

  return { deleted: true };
});

module.exports = {
  deleteUserAsAdmin,
};
