import 'dotenv/config';
import { corsair } from "./corsair";

const main = async () => {
  try {
    // Remove .withTenant('dev') since it's a single-tenant client instance
    const res = await corsair.gmail.api.threads.list({});
    console.log("Gmail Threads:", res);
  } catch (error) {
    console.error("Failed to fetch threads:", error);
  }
};

main();
