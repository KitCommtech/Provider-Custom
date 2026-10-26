// server/index.ts
import express2 from "express";

// client/src/lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
var validate = (options) => {
  return (req, res, next) => {
    try {
      if (options.body) {
        const result = options.body.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: "Body validation failed",
            errors: result.error.flatten()
          });
        }
        req.body = result.data;
      }
      if (options.query) {
        const result = options.query.safeParse(req.query);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: "Query validation failed",
            errors: result.error.flatten()
          });
        }
        req.query = result.data;
      }
      if (options.params) {
        const result = options.params.safeParse(req.params);
        if (!result.success) {
          return res.status(400).json({
            success: false,
            message: "Params validation failed",
            errors: result.error.flatten()
          });
        }
        req.params = result.data;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

// shared/schema.ts
import { z } from "zod";
var loginUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password must be at least 6 characters long")
});
var UserSchema = z.object({
  username: z.string().max(128),
  value: z.string()
});
var UserInfoSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().max(128),
  firstname: z.string().max(200).nullable(),
  lastname: z.string().max(200).nullable(),
  email: z.string().max(200).nullable(),
  department: z.string().max(200).nullable(),
  company: z.string().max(200).nullable(),
  workphone: z.string().max(200).nullable(),
  homephone: z.string().max(200).nullable(),
  mobilephone: z.string().max(200).nullable(),
  address: z.string().max(200).nullable(),
  city: z.string().max(200).nullable(),
  state: z.string().max(200).nullable(),
  country: z.string().max(100).nullable(),
  zip: z.string().max(200).nullable(),
  notes: z.string().max(200).nullable(),
  changeuserinfo: z.string().max(128).nullable(),
  portalloginpassword: z.string().max(128).default(""),
  enableportallogin: z.number().int().default(0),
  creationdate: z.date().or(z.string()).default(/* @__PURE__ */ new Date("0000-00-00 00:00:00")).nullable(),
  creationby: z.string().max(128).nullable(),
  updatedate: z.date().or(z.string()).default(/* @__PURE__ */ new Date("0000-00-00 00:00:00")).nullable(),
  updateby: z.string().max(128).nullable(),
  providerData: z.string(),
  password: z.string().optional()
});
var MappedUserInfoSchema = UserInfoSchema.omit({ id: true });
var ProviderTokenResponseSchema = z.object({
  token_type: z.string().describe("\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E02\u0E2D\u0E07 token"),
  expires_in: z.number().int().positive().describe("\u0E40\u0E27\u0E25\u0E32\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E02\u0E2D\u0E07 token"),
  access_token: z.string().describe("token \u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E01\u0E32\u0E23\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19"),
  expiration_date: z.string().datetime().describe("\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E02\u0E2D\u0E07 token"),
  account_id: z.string().describe("\u0E44\u0E2D\u0E14\u0E35\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19"),
  result: z.string().describe("\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E01\u0E32\u0E23\u0E40\u0E23\u0E35\u0E22\u0E01 API"),
  username: z.string().describe("username \u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19"),
  login_by: z.string().describe("\u0E27\u0E34\u0E18\u0E35\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A access_token")
});
var OrganizationSchema = z.object({
  business_id: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E25\u0E02\u0E23\u0E2B\u0E31\u0E2A\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23"),
  position: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07"),
  hcode: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E2B\u0E31\u0E2A\u0E42\u0E23\u0E07\u0E1E\u0E22\u0E32\u0E1A\u0E32\u0E25"),
  hname_th: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E0A\u0E37\u0E48\u0E2D\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"),
  hname_eng: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E0A\u0E37\u0E48\u0E2D\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29"),
  tax_id: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E25\u0E02\u0E17\u0E35\u0E48\u0E40\u0E2A\u0E35\u0E22\u0E20\u0E32\u0E29\u0E35"),
  license_expired_date: z.string().datetime().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E27\u0E31\u0E19\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E40\u0E25\u0E02\u0E43\u0E1A\u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A\u0E27\u0E34\u0E0A\u0E32\u0E0A\u0E35\u0E1E"),
  expertise: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E27\u0E34\u0E0A\u0E32\u0E0A\u0E35\u0E1E\u0E40\u0E09\u0E1E\u0E32\u0E30"),
  moph_access_token_idp: z.string().optional().describe("MOPH-JWT"),
  moph_access_token_idp_fdh: z.string().optional().describe("MOPH-JWT (fdh) (\u0E02\u0E36\u0E49\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E01\u0E31\u0E1A\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E43\u0E19\u0E01\u0E32\u0E23\u0E02\u0E2D Token)"),
  moph_access_token_idp_pcu: z.string().optional().describe("MOPH-JWT (pcu) (\u0E02\u0E36\u0E49\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E01\u0E31\u0E1A\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E43\u0E19\u0E01\u0E32\u0E23\u0E02\u0E2D Token)"),
  is_hr_admin: z.string().optional().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E34\u0E17\u0E18\u0E43\u0E19\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E2B\u0E19\u0E49\u0E32 admin"),
  is_director: z.string().optional().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25"),
  position_type: z.string().optional().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07"),
  address: z.object({
    address: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23"),
    moo: z.string().optional().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2B\u0E21\u0E39\u0E48"),
    building: z.string().optional().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2D\u0E32\u0E04\u0E32\u0E23"),
    soi: z.string().optional().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E0B\u0E2D\u0E22"),
    street: z.string().optional().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E16\u0E19\u0E19"),
    province: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E31\u0E14"),
    district: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2D\u0E33\u0E40\u0E20\u0E2D"),
    sub_district: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E33\u0E1A\u0E25"),
    zip_code: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E2B\u0E31\u0E2A\u0E44\u0E1B\u0E23\u0E29\u0E13\u0E35\u0E22\u0E4C")
  }).describe("\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23")
});
var UserResponseSchema = z.object({
  account_id: z.string().describe("Identities Number \u0E17\u0E35\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E2B\u0E49\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E42\u0E14\u0E22\u0E41\u0E15\u0E48\u0E25\u0E30\u0E04\u0E19 (ID) \u0E44\u0E21\u0E48\u0E0B\u0E49\u0E33\u0E01\u0E31\u0E19"),
  hash_cid: z.string().describe("\u0E40\u0E25\u0E02\u0E1A\u0E31\u0E15\u0E23\u0E1B\u0E23\u0E30\u0E0A\u0E32\u0E0A\u0E19\u0E17\u0E35\u0E48 Hash \u0E14\u0E49\u0E27\u0E22 SHA256"),
  provider_id: z.string().describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E25\u0E02 Provider id"),
  title_th: z.string().describe("\u0E04\u0E33\u0E19\u0E33\u0E2B\u0E19\u0E49\u0E32\u0E0A\u0E37\u0E48\u0E2D\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"),
  special_title_th: z.string().describe("\u0E04\u0E33\u0E19\u0E33\u0E2B\u0E19\u0E49\u0E32\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E41\u0E1E\u0E17\u0E22\u0E4C\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"),
  name_th: z.string().describe("\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E19\u0E32\u0E21\u0E2A\u0E01\u0E38\u0E25\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"),
  name_eng: z.string().describe("\u0E0A\u0E37\u0E48\u0E2D\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29"),
  created_at: z.string().datetime().describe("\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25"),
  title_en: z.string().describe("\u0E04\u0E33\u0E19\u0E33\u0E2B\u0E19\u0E49\u0E32\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29"),
  special_title_name_en: z.string().describe("\u0E04\u0E33\u0E19\u0E33\u0E2B\u0E19\u0E49\u0E32\u0E0A\u0E37\u0E48\u0E2D\u0E17\u0E32\u0E07\u0E01\u0E32\u0E23\u0E41\u0E1E\u0E17\u0E22\u0E4C\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29"),
  firstname_th: z.string().describe("\u0E0A\u0E37\u0E48\u0E2D\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"),
  lastname_th: z.string().describe("\u0E19\u0E32\u0E21\u0E2A\u0E01\u0E38\u0E25\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22"),
  firstname_en: z.string().describe("\u0E0A\u0E37\u0E48\u0E2D\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29"),
  lastname_en: z.string().describe("\u0E19\u0E32\u0E21\u0E2A\u0E01\u0E38\u0E25\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29"),
  ref_code: z.string().optional().describe("ref_code \u0E08\u0E32\u0E01 Station"),
  organization: OrganizationSchema.describe("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2D\u0E07\u0E04\u0E4C\u0E01\u0E23")
});
var CallBackSchema = z.object({
  code: z.string(),
  state: z.string()
});

// server/routes.ts
import { createServer } from "http";

// server/radius-client.ts
import radius from "radius";
import dgram from "dgram";
import dotenv from "dotenv";
import { randomBytes } from "crypto";

// server/logger.ts
import pino from "pino";
var LOG_LEVEL = process.env.LOG_LEVEL || "info";
var isDevelopment = process.env.NODE_ENV === "development";
var REDACT_PATHS = [
  "password",
  "*.password",
  "*.*.password",
  "secret",
  "*.secret",
  "*.*.secret",
  "nasSecret",
  "*.nasSecret",
  "token",
  "*.token",
  "*.*.token",
  "access_token",
  "*.access_token",
  "*.*.access_token",
  "client_secret",
  "*.client_secret",
  "*.*.client_secret",
  "secret_key",
  "*.secret_key",
  "*.*.secret_key"
];
var logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: "[Redacted]"
  },
  ...isDevelopment ? {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname"
      }
    }
  } : {}
});

// server/radius-client.ts
dotenv.config();
var SERVER_HOST = process.env.RADIUS_SERVER_HOST || "127.0.0.1";
var SERVER_PORT = parseInt(process.env.RADIUS_SERVER_PORT || "1812", 10);
var SHARED_SECRET = process.env.RADIUS_SECRET || "testing123";
var REQUEST_TIMEOUT_MS = 1e4;
if (!SHARED_SECRET) {
  logger.error({ action: "radius_config" }, "Error: RADIUS_SECRET is not defined in the .env file.");
  process.exit(1);
}
var disconnectUser = async (target) => {
  const { username, nasipaddress, acctsessionid, callingstationid } = target;
  const coaPort = parseInt(process.env.RADIUS_COA_PORT || "3799", 10);
  const nasSecret = target.secret || SHARED_SECRET;
  let client = null;
  let requestIdentifier = randomBytes(1).readUInt8(0);
  let timer = null;
  const attributes = {
    "User-Name": username,
    "NAS-IP-Address": nasipaddress,
    "Acct-Session-Id": acctsessionid || "",
    "Calling-Station-Id": callingstationid || ""
  };
  const requestPacket = {
    code: "Disconnect-Request",
    secret: nasSecret,
    identifier: requestIdentifier,
    attributes,
    add_message_authenticator: true
  };
  return new Promise((resolve, reject) => {
    try {
      client = dgram.createSocket("udp4");
      const encodedRequest = radius.encode(requestPacket);
      logger.info(
        {
          action: "radius_disconnect_request",
          data: { username, attributes, coaPort }
        },
        `[RADIUS] Sending Disconnect-Request for "${username}" to ${nasipaddress}:${coaPort}`
      );
      timer = setTimeout(() => {
        logger.error(
          { action: "radius_disconnect_request", data: { username, attributes } },
          `[RADIUS] Disconnect-Request for "${username}" timed out.`
        );
        client?.close();
        reject(new Error(`RADIUS Disconnect-Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);
      client.on("message", (msg) => {
        if (timer) clearTimeout(timer);
        try {
          const decodedResponse = radius.decode({
            packet: msg,
            secret: nasSecret
          });
          if (decodedResponse.identifier !== requestIdentifier) {
            logger.warn(
              { action: "radius_disconnect_request", data: { username } },
              `[RADIUS] Mismatched identifier for disconnect of "${username}"`
            );
            return;
          }
          logger.info(
            {
              action: "radius_disconnect_request",
              data: { username, code: decodedResponse.code }
            },
            `[RADIUS] Received response code: ${decodedResponse.code} for disconnect of "${username}"`
          );
          let result;
          switch (decodedResponse.code) {
            case "Disconnect-ACK":
              result = {
                success: true,
                message: "Disconnect acknowledged by NAS.",
                attributes: decodedResponse.attributes
              };
              break;
            case "Disconnect-NAK":
              result = {
                success: false,
                message: decodedResponse.attributes?.["Reply-Message"] || "Disconnect not acknowledged by NAS."
              };
              break;
            default:
              result = {
                success: false,
                message: `Received unexpected RADIUS code: ${decodedResponse.code}`
              };
              break;
          }
          client?.close();
          resolve(result);
        } catch (decodeError) {
          logger.error(
            {
              action: "radius_disconnect_request",
              data: { username },
              err: decodeError
            },
            `[RADIUS] Decode error for disconnect of "${username}"`
          );
          client?.close();
          reject(new Error(`Failed to decode Disconnect response: ${decodeError.message}`));
        }
      });
      client.on("error", (err) => {
        if (timer) clearTimeout(timer);
        logger.error(
          { action: "radius_disconnect_request", data: { username }, err },
          `[RADIUS] Socket error for disconnect of "${username}"`
        );
        client?.close();
        reject(new Error(`UDP Socket error: ${err.message}`));
      });
      client.send(encodedRequest, 0, encodedRequest.length, coaPort, nasipaddress, (err) => {
        if (err) {
          if (timer) clearTimeout(timer);
          logger.error(
            {
              action: "radius_disconnect_request",
              data: { username },
              err
            },
            `[RADIUS] Failed to send Disconnect-Request for "${username}"`
          );
          client?.close();
          reject(new Error(`Failed to send Disconnect-Request: ${err.message}`));
        } else {
          logger.info(
            { action: "radius_disconnect_request", data: { username } },
            `[RADIUS] Disconnect-Request sent successfully for "${username}".`
          );
        }
      });
    } catch (setupError) {
      logger.error(
        {
          action: "radius_disconnect_request",
          data: { username },
          err: setupError
        },
        "[RADIUS] Setup error for Disconnect-Request"
      );
      if (timer) clearTimeout(timer);
      client?.close();
      reject(new Error(`Error setting up RADIUS Disconnect: ${setupError.message}`));
    }
  });
};
var authenticateUser = async (username, password) => {
  let client = null;
  let requestIdentifier = randomBytes(1).readUInt8(0);
  let timer = null;
  const attributes = {
    "User-Name": username,
    "User-Password": password,
    "NAS-Identifier": "AuthSecureGate"
  };
  const requestPacket = {
    code: "Access-Request",
    secret: SHARED_SECRET,
    identifier: requestIdentifier,
    attributes
  };
  return new Promise((resolve, reject) => {
    try {
      client = dgram.createSocket("udp4");
      const encodedRequest = radius.encode(requestPacket);
      logger.info(
        {
          action: "radius_authenticate",
          data: { username, host: SERVER_HOST, port: SERVER_PORT }
        },
        `[RADIUS] Sending Access-Request for user "${username}" to ${SERVER_HOST}:${SERVER_PORT}`
      );
      timer = setTimeout(() => {
        logger.error(
          { action: "radius_authenticate", data: { username } },
          `[RADIUS] Request for user "${username}" timed out.`
        );
        client?.close();
        reject(new Error(`RADIUS request timed out after ${REQUEST_TIMEOUT_MS}ms`));
      }, REQUEST_TIMEOUT_MS);
      client.on("message", (msg, rinfo) => {
        if (timer) clearTimeout(timer);
        try {
          const decodedResponse = radius.decode({
            packet: msg,
            secret: SHARED_SECRET
          });
          if (decodedResponse.identifier !== requestIdentifier) {
            logger.warn(
              { action: "radius_authenticate", data: { username } },
              `[RADIUS] Mismatched identifier for user "${username}"`
            );
            return;
          }
          logger.info(
            {
              action: "radius_authenticate",
              data: { username, code: decodedResponse.code }
            },
            `[RADIUS] Received response code: ${decodedResponse.code} for user "${username}"`
          );
          let result;
          switch (decodedResponse.code) {
            case "Access-Accept":
              result = {
                success: true,
                message: "Authentication successful.",
                attributes: decodedResponse.attributes
              };
              break;
            case "Access-Reject":
              result = {
                success: false,
                message: decodedResponse.attributes["Reply-Message"] || "Authentication rejected by server."
              };
              break;
            case "Access-Challenge":
              result = {
                success: false,
                message: "Access-Challenge received (not supported by this client)."
              };
              break;
            default:
              result = {
                success: false,
                message: `Received unexpected RADIUS code: ${decodedResponse.code}`
              };
              break;
          }
          client?.close();
          resolve(result);
        } catch (decodeError) {
          logger.error(
            {
              action: "radius_authenticate",
              data: { username },
              err: decodeError
            },
            `[RADIUS] Decode error for user "${username}"`
          );
          client?.close();
          reject(new Error(`Failed to decode RADIUS response: ${decodeError.message}`));
        }
      });
      client.on("error", (err) => {
        if (timer) clearTimeout(timer);
        logger.error(
          { action: "radius_authenticate", data: { username }, err },
          `[RADIUS] Socket error for user "${username}"`
        );
        client?.close();
        reject(new Error(`UDP Socket error: ${err.message}`));
      });
      client.send(encodedRequest, 0, encodedRequest.length, SERVER_PORT, SERVER_HOST, (err) => {
        if (err) {
          if (timer) clearTimeout(timer);
          logger.error(
            {
              action: "radius_authenticate",
              data: { username },
              err
            },
            `[RADIUS] Failed to send packet for user "${username}"`
          );
          client?.close();
          reject(new Error(`Failed to send RADIUS packet: ${err.message}`));
        } else {
          logger.info(
            { action: "radius_authenticate", data: { username } },
            `[RADIUS] Packet sent successfully for user "${username}".`
          );
        }
      });
    } catch (setupError) {
      logger.error({ action: "radius_authenticate", err: setupError }, "[RADIUS] Setup error");
      if (timer) clearTimeout(timer);
      client?.close();
      reject(new Error(`Error setting up RADIUS client: ${setupError.message}`));
    }
  });
};

// server/database.ts
import mysql from "mysql2/promise";
import dotenv2 from "dotenv";
dotenv2.config();
var dbConfig = {
  // Configuration for MySQL connection pool
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  // Default MySQL port is 3306
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  // Wait if pool is full
  connectionLimit: 10,
  // Max connections in pool
  queueLimit: 0
  // Unlimited queue
};
var pool = null;
try {
  pool = mysql.createPool(dbConfig);
  logger.info(
    { action: "db_pool_create", data: { database: dbConfig.database } },
    `[DB] MySQL Connection Pool created successfully for database ${dbConfig.database}`
  );
  pool.getConnection().then((connection) => {
    logger.info(
      { action: "db_connect" },
      "[DB] Successfully connected to database."
    );
    connection.release();
  }).catch((err) => {
    logger.error(
      { action: "db_connect", err },
      "[DB] Error connecting to database"
    );
    process.exit(1);
  });
} catch (error) {
  logger.error(
    { action: "db_pool_create", err: error },
    "[DB] Failed to create MySQL Pool"
  );
  process.exit(1);
}
var findUserinfo = async (username) => {
  if (!pool) {
    throw new Error("Database connection pool is not initialized.");
  }
  const sql = "SELECT * FROM userinfo WHERE username = ?";
  try {
    const [rows] = await pool.execute(sql, [username]);
    if (rows.length > 0) {
      return rows[0];
    } else {
      return null;
    }
  } catch (error) {
    logger.error(
      { action: "db_query_userinfo", data: { username }, err: error },
      `[DB] Error querying user info "${username}"`
    );
    throw new Error(`Database query failed for user info ${username}.`);
  }
};
var findUser = async (username) => {
  if (!pool) {
    throw new Error("Database connection pool is not initialized.");
  }
  const sql = "SELECT * FROM radcheck WHERE username = ?";
  try {
    const [rows] = await pool.execute(sql, [username]);
    if (rows.length > 0) {
      return rows[0];
    } else {
      return null;
    }
  } catch (error) {
    logger.error(
      { action: "db_query_user", data: { username }, err: error },
      `[DB] Error querying user "${username}"`
    );
    throw new Error(`Database query failed for user ${username}.`);
  }
};
var insertUserWithRadius = async (userData, radiusPassword) => {
  if (!pool) {
    throw new Error("Database connection pool is not initialized.");
  }
  let connection = null;
  try {
    connection = await pool.getConnection();
    logger.info(
      { action: "db_insert_user", data: { username: userData.username } },
      "[DB Transaction] Beginning transaction for new user"
    );
    await connection.beginTransaction();
    const userFields = Object.keys(userData).filter((k) => k !== "id" && k !== "creationdate" && k !== "updatedate").join(", ");
    const userPlaceholders = Object.keys(userData).filter((k) => k !== "id" && k !== "creationdate" && k !== "updatedate").map(() => "?").join(", ");
    const userValues = Object.keys(userData).filter((k) => k !== "id" && k !== "creationdate" && k !== "updatedate").map((k) => userData[k]);
    const userSql = `INSERT INTO userinfo (${userFields}, creationdate, updatedate) VALUES (${userPlaceholders}, NOW(), NOW())`;
    const [userResult] = await connection.execute(
      userSql,
      userValues
    );
    const newUserId = userResult.insertId;
    logger.info(
      { action: "db_insert_user", data: { userId: newUserId } },
      `[DB Transaction] Inserted into userinfo (ID: ${newUserId})`
    );
    const radcheckSql = `INSERT INTO radcheck (username, attribute, op, value) VALUES (?, ?, ?, ?)`;
    const radcheckValues = [
      userData.username,
      "Cleartext-Password",
      ":=",
      radiusPassword
    ];
    await connection.execute(radcheckSql, radcheckValues);
    logger.info(
      { action: "db_insert_user", data: { username: userData.username } },
      `[DB Transaction] Inserted into radcheck for user: ${userData.username}`
    );
    await connection.commit();
    logger.info(
      { action: "db_insert_user", data: { username: userData.username } },
      `[DB Transaction] Committed successfully for user: ${userData.username}`
    );
    return newUserId;
  } catch (error) {
    logger.error(
      {
        action: "db_insert_user",
        data: { username: userData.username || "(unknown)" },
        err: error
      },
      `[DB Transaction] Error during transaction for user ${userData.username || "(unknown)"}`
    );
    if (connection) {
      try {
        await connection.rollback();
        logger.info(
          { action: "db_insert_user" },
          "[DB Transaction] Rollback successful."
        );
      } catch (rollbackError) {
        logger.error(
          { action: "db_insert_user", err: rollbackError },
          "[DB Transaction] Error during rollback"
        );
      }
    }
    throw new Error(`Database transaction failed: ${error.message}`);
  } finally {
    if (connection) {
      connection.release();
      logger.info(
        { action: "db_insert_user" },
        "[DB Transaction] Connection released."
      );
    }
  }
};
var findActiveRadiusSession = async (username) => {
  if (!pool) {
    throw new Error("Database connection pool is not initialized.");
  }
  const sql = `SELECT username, nasipaddress, acctsessionid, callingstationid, acctstarttime
               FROM radacct
               WHERE username = ? AND (acctstoptime IS NULL)
               ORDER BY acctstarttime DESC
               LIMIT 1`;
  try {
    const [rows] = await pool.execute(sql, [username]);
    if (rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch (error) {
    logger.error(
      { action: "db_query_active_session", data: { username }, err: error },
      `[DB] Error querying active RADIUS session for "${username}"`
    );
    return null;
  }
};
var findActiveRadiusSessionByFramedIp = async (framedIp) => {
  if (!pool) {
    throw new Error("Database connection pool is not initialized.");
  }
  const sql = `SELECT username, nasipaddress, acctsessionid, callingstationid, acctstarttime, framedipaddress
               FROM radacct
               WHERE framedipaddress = ? AND (acctstoptime IS NULL)
               ORDER BY acctstarttime DESC
               LIMIT 1`;
  try {
    const [rows] = await pool.execute(sql, [framedIp]);
    if (rows.length > 0) {
      return rows[0];
    }
    return null;
  } catch (error) {
    logger.error(
      { action: "db_query_session_by_framed_ip", err: error },
      `[DB] Error querying active RADIUS session for framed IP`
    );
    return null;
  }
};
var findExpiredRadiusSessions = async (timeoutHours) => {
  if (!pool) {
    throw new Error("Database connection pool is not initialized.");
  }
  const sql = `SELECT username, nasipaddress, acctsessionid, callingstationid, acctstarttime
               FROM radacct
               WHERE acctstoptime IS NULL
                 AND acctstarttime <= DATE_SUB(NOW(), INTERVAL ? HOUR)
               ORDER BY acctstarttime ASC`;
  try {
    const [rows] = await pool.execute(sql, [
      timeoutHours
    ]);
    return rows;
  } catch (error) {
    logger.error(
      {
        action: "db_query_expired_sessions",
        data: { timeoutHours },
        err: error
      },
      `[DB] Error querying expired RADIUS sessions (timeout ${timeoutHours}h)`
    );
    return [];
  }
};
var findNasSecret = async (nasipaddress) => {
  if (!pool) {
    throw new Error("Database connection pool is not initialized.");
  }
  try {
    const [rows] = await pool.execute(
      "SELECT secret FROM nas WHERE nasname = ? LIMIT 1",
      [nasipaddress]
    );
    if (rows.length > 0 && rows[0].secret) {
      return rows[0].secret;
    }
    return null;
  } catch (error) {
    logger.error(
      { action: "db_query_nas_secret", data: { nasipaddress }, err: error },
      `[DB] Error querying NAS secret for "${nasipaddress}"`
    );
    return null;
  }
};
var updateUserInfo = async (userId, userData) => {
  if (!pool) {
    throw new Error("Database connection pool is not initialized.");
  }
  const fieldsToUpdate = Object.keys(userData).filter(
    (k) => k !== "id" && k !== "creationdate" && k !== "creationby" && k !== "updatedate"
  );
  if (fieldsToUpdate.length === 0) {
    logger.info(
      { action: "db_update_userinfo", data: { userId } },
      "[DB] No fields to update for user"
    );
    return true;
  }
  const setClauses = fieldsToUpdate.map((field) => `${field} = ?`).join(", ");
  const values = fieldsToUpdate.map(
    (field) => userData[field]
  );
  values.push(userId);
  const sql = `UPDATE userinfo SET ${setClauses}, updateby = ?, updatedate = NOW() WHERE id = ?`;
  values.splice(values.length - 1, 0, userData.updateby || "OAuthCallback");
  try {
    const [result] = await pool.execute(sql, values);
    logger.info(
      {
        action: "db_update_userinfo",
        data: { userId, affectedRows: result.affectedRows }
      },
      `[DB] Updated user ID: ${userId}. Rows affected: ${result.affectedRows}`
    );
    return result.affectedRows > 0;
  } catch (error) {
    logger.error(
      { action: "db_update_userinfo", data: { userId }, err: error },
      `[DB] Error updating user ${userId}`
    );
    throw new Error(`Database update failed for user ${userId}.`);
  }
};

// server/session.ts
import dotenv3 from "dotenv";
import { randomBytes as randomBytes2 } from "crypto";
dotenv3.config();
var COOKIE_NAME = "auth_session";
var SESSION_TIMEOUT_HOURS = parseInt(
  process.env.SESSION_TIMEOUT_HOURS || "8",
  10
);
var SESSION_TIMEOUT_MS = SESSION_TIMEOUT_HOURS * 60 * 60 * 1e3;
var COOKIE_MAX_AGE_SECONDS = Math.floor(SESSION_TIMEOUT_MS / 1e3) + 300;
var SESSION_HARD_TTL_MS = COOKIE_MAX_AGE_SECONDS * 1e3;
var sessions = /* @__PURE__ */ new Map();
function parseCookieHeader(header) {
  const result = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}
function resolveSession(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) return null;
  const data = sessions.get(sessionId);
  if (!data) return null;
  return { id: sessionId, data };
}
function isExpired(data) {
  return Date.now() - data.loginAt >= SESSION_TIMEOUT_MS;
}
function createSession(user, res) {
  const sessionId = randomBytes2(32).toString("hex");
  sessions.set(sessionId, { user, loginAt: Date.now() });
  res.appendHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}`
  );
  logger.info(
    { action: "session_create", data: { username: user.username } },
    `[Session] Created session for user: ${user.username}`
  );
}
function getSession(req) {
  const resolved = resolveSession(req);
  if (!resolved) return null;
  if (isExpired(resolved.data)) return null;
  return resolved.data;
}
function peekSession(req) {
  return resolveSession(req)?.data ?? null;
}
var SESSION_IP_FALLBACK_ENABLED = !/^(false|0|no|off)$/i.test(
  (process.env.SESSION_IP_FALLBACK_ENABLED || "true").trim()
);
function getClientIp(req) {
  const raw = req.socket?.remoteAddress;
  if (!raw) return null;
  const ip = raw.startsWith("::ffff:") ? raw.slice("::ffff:".length) : raw;
  return ip || null;
}
function isRadiusStartWithinTimeout(acctstarttime) {
  if (!acctstarttime) return false;
  const start = new Date(acctstarttime).getTime();
  if (Number.isNaN(start)) return false;
  return Date.now() - start < SESSION_TIMEOUT_MS;
}
function deleteSessionsByUsername(username) {
  const removed = Array.from(sessions.entries()).filter(
    ([, data]) => data.user.username === username
  );
  if (removed.length === 0) return;
  for (const [id] of removed) {
    sessions.delete(id);
  }
  logger.info(
    {
      action: "session_delete_expired",
      data: { username, removedCount: removed.length }
    },
    `[Session] Removed ${removed.length} expired session(s) after CoA for user: ${username}`
  );
}
function pruneSessions() {
  const now = Date.now();
  let removed = 0;
  for (const [id, data] of Array.from(sessions.entries())) {
    if (now - data.loginAt >= SESSION_HARD_TTL_MS) {
      sessions.delete(id);
      removed++;
    }
  }
  if (removed > 0) {
    logger.info(
      { action: "session_prune", data: { removedCount: removed } },
      `[Session] Pruned ${removed} stale session(s) older than the cookie lifetime.`
    );
  }
  return removed;
}
function destroySession(req, res) {
  const resolved = resolveSession(req);
  if (resolved) {
    sessions.delete(resolved.id);
    logger.info(
      {
        action: "session_destroy",
        data: { username: resolved.data.user.username }
      },
      `[Session] Destroyed session for user: ${resolved.data.user.username}`
    );
  }
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
  );
}

// server/auth.ts
import dotenv4 from "dotenv";
import { randomBytes as randomBytes3 } from "crypto";

// server/utils.ts
var handleFetchError = async (response, url) => {
  let errorData;
  try {
    errorData = await response.json();
  } catch (e) {
    try {
      errorData = await response.text();
    } catch (textError) {
      errorData = response.statusText;
    }
  }
  const errorMessage = `HTTP error ${response.status} (${response.statusText}) calling ${url}: ${errorData?.message || JSON.stringify(errorData)}`;
  logger.error(
    { action: "fetch_error", data: { url } },
    `[Fetch Error] ${errorMessage}`
  );
  throw new Error(errorMessage);
};

// server/auth.ts
dotenv4.config();
var activeOAuthStates = /* @__PURE__ */ new Map();
var STATE_TTL_MS = 5 * 60 * 1e3;
var HEALTH_ID_URL = process.env.HEALTH_ID_URL;
var HEALTH_ID_URL_WEB = process.env.HEALTH_ID_URL_WEB;
var HEALTH_ID_CLIENT_ID = process.env.HEALTH_ID_CLIENT_ID;
var HEALTH_ID_CLIENT_SECRET = process.env.HEALTH_ID_CLIENT_SECRET;
var PROVIDER_ID_URL = process.env.PROVIDER_ID_URL;
var PROVIDER_ID_CLIENT_ID = process.env.PROVIDER_ID_CLIENT_ID;
var PROVIDER_ID_SECRET_KEY = process.env.PROVIDER_ID_SECRET_KEY;
var REDIRECT_URI = process.env.REDIRECT_URI;
var HOSPITAL_CODE = process.env.HOSPITAL_CODE;
var generateAuthorizeUrl = () => {
  if (!HEALTH_ID_URL_WEB || !HEALTH_ID_CLIENT_ID || !REDIRECT_URI) {
    logger.error(
      { action: "oauth_authorize_url" },
      "[OAuth] Missing required environment variables: HEALTH_ID_URL_WEB, HEALTH_ID_CLIENT_ID, or REDIRECT_URI"
    );
    throw new Error("Health ID OAuth configuration is incomplete.");
  }
  const state = randomBytes3(16).toString("hex");
  if (activeOAuthStates.has(state)) {
    clearTimeout(activeOAuthStates.get(state));
  }
  const timeoutId = setTimeout(() => {
    activeOAuthStates.delete(state);
    logger.info(
      {
        action: "oauth_state_expire",
        data: { statePreview: `${state.substring(0, 8)}...` }
      },
      "[OAuth State] Expired and removed state"
    );
  }, STATE_TTL_MS);
  activeOAuthStates.set(state, timeoutId);
  logger.info(
    {
      action: "oauth_state_store",
      data: {
        statePreview: `${state.substring(0, 8)}...`,
        ttlSeconds: STATE_TTL_MS / 1e3
      }
    },
    "[OAuth State] Stored state"
  );
  return `${HEALTH_ID_URL_WEB}/oauth/redirect?client_id=${HEALTH_ID_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&state=${state}`;
};
var verifyAndConsumeState = (state) => {
  if (activeOAuthStates.has(state)) {
    clearTimeout(activeOAuthStates.get(state));
    activeOAuthStates.delete(state);
    logger.info(
      {
        action: "oauth_state_consume",
        data: { statePreview: `${state.substring(0, 8)}...` }
      },
      "[OAuth State] Verified and consumed state"
    );
    return true;
  }
  logger.warn(
    {
      action: "oauth_state_consume",
      data: { statePreview: `${state.substring(0, 8)}...` }
    },
    "[OAuth State] Invalid or expired state received"
  );
  return false;
};
var exchangeHealthIdCodeForToken = async (code) => {
  if (!HEALTH_ID_URL || !HEALTH_ID_CLIENT_ID || !HEALTH_ID_CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Health ID OAuth configuration is incomplete.");
  }
  const tokenUrl = `${HEALTH_ID_URL}/api/v1/token`;
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: HEALTH_ID_CLIENT_ID,
    client_secret: HEALTH_ID_CLIENT_SECRET
  });
  try {
    logger.info(
      { action: "oauth_exchange_health_id_code", data: { tokenUrl } },
      `[OAuth Callback] Exchanging Health ID code at: ${tokenUrl} (using fetch)`
    );
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    if (!response.ok) {
      await handleFetchError(response, tokenUrl);
    }
    const responseData = await response.json();
    if (responseData && responseData.data && responseData.data.access_token) {
      logger.info(
        { action: "oauth_exchange_health_id_code" },
        "[OAuth Callback] Successfully obtained Health ID token (using fetch)"
      );
      return responseData.data.access_token;
    } else {
      logger.error(
        { action: "oauth_exchange_health_id_code", data: { responseData } },
        "[OAuth Callback] Invalid response structure from Health ID token endpoint (fetch)"
      );
      throw new Error(
        "Failed to get access_token from Health ID (fetch): Invalid response structure."
      );
    }
  } catch (error) {
    logger.error(
      { action: "oauth_exchange_health_id_code", err: error },
      "[OAuth Callback] Error exchanging Health ID code (fetch)"
    );
    throw new Error(
      `Failed to exchange Health ID code (fetch): ${error.message}`
    );
  }
};
var exchangeHealthIdTokenForProviderToken = async (healthIdToken) => {
  if (!PROVIDER_ID_URL || !PROVIDER_ID_CLIENT_ID || !PROVIDER_ID_SECRET_KEY) {
    throw new Error("Provider ID OAuth configuration is incomplete.");
  }
  const tokenUrl = `${PROVIDER_ID_URL}/api/v1/services/token`;
  const body = JSON.stringify({
    client_id: PROVIDER_ID_CLIENT_ID,
    secret_key: PROVIDER_ID_SECRET_KEY,
    token_by: "Health ID",
    token: healthIdToken
  });
  try {
    logger.info(
      { action: "oauth_exchange_provider_token", data: { tokenUrl } },
      `[OAuth Callback] Exchanging Provider ID token at: ${tokenUrl} (using fetch)`
    );
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    if (!response.ok) {
      await handleFetchError(response, tokenUrl);
    }
    const responseData = await response.json();
    if (responseData && responseData.data && responseData.data.access_token && responseData.data.account_id) {
      logger.info(
        {
          action: "oauth_exchange_provider_token",
          data: { accountId: responseData.data.account_id }
        },
        "[OAuth Callback] Successfully obtained Provider ID token for account (fetch)"
      );
      return responseData.data;
    } else {
      logger.error(
        { action: "oauth_exchange_provider_token", data: { responseData } },
        "[OAuth Callback] Invalid response structure from Provider ID token endpoint (fetch)"
      );
      throw new Error(
        "Failed to get access_token/account_id from Provider ID (fetch): Invalid response structure."
      );
    }
  } catch (error) {
    logger.error(
      { action: "oauth_exchange_provider_token", err: error },
      "[OAuth Callback] Error exchanging Provider ID token (fetch)"
    );
    throw new Error(
      `Failed to exchange Provider ID token (fetch): ${error.message}`
    );
  }
};
var fetchProviderProfile = async (providerAccessToken) => {
  if (!PROVIDER_ID_URL || !PROVIDER_ID_CLIENT_ID || !PROVIDER_ID_SECRET_KEY) {
    throw new Error("Provider ID OAuth configuration is incomplete.");
  }
  const profileUrl = `${PROVIDER_ID_URL}/api/v1/services/profile`;
  try {
    logger.info(
      { action: "oauth_fetch_provider_profile", data: { profileUrl } },
      `[OAuth Callback] Fetching Provider profile from: ${profileUrl} (using fetch)`
    );
    const response = await fetch(profileUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${providerAccessToken}`,
        "client-id": PROVIDER_ID_CLIENT_ID,
        "secret-key": PROVIDER_ID_SECRET_KEY,
        "Content-Type": "application/json"
      }
    });
    if (!response.ok) {
      await handleFetchError(response, profileUrl);
    }
    const responseData = await response.json();
    if (responseData && responseData.data) {
      logger.info(
        { action: "oauth_fetch_provider_profile" },
        "[OAuth Callback] Successfully fetched Provider profile (using fetch)."
      );
      const result = Array.isArray(responseData.data.organization) && responseData.data.organization.length > 0 ? {
        ...responseData.data,
        organization: responseData.data.organization[0]
      } : responseData.data;
      if (HOSPITAL_CODE && HOSPITAL_CODE !== result?.organization.hcode) {
        logger.warn(
          {
            action: "oauth_fetch_provider_profile",
            data: { organization: result?.organization }
          },
          "[OAuth Callback] Throw Error not match hospital code"
        );
        throw new Error(`\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E31\u0E07\u0E01\u0E31\u0E14\u0E02\u0E2D\u0E07\u0E17\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48 ${HOSPITAL_CODE}`);
      }
      return result;
    } else {
      logger.error(
        {
          action: "oauth_fetch_provider_profile",
          data: { responseData }
        },
        "[OAuth Callback] Invalid response structure from Provider ID profile endpoint (fetch)"
      );
      throw new Error(
        "Failed to get profile data from Provider ID (fetch): Invalid response structure."
      );
    }
  } catch (error) {
    logger.error(
      { action: "oauth_fetch_provider_profile", err: error },
      "[OAuth Callback] Error fetching Provider profile (fetch)"
    );
    throw new Error(
      `Failed to fetch Provider profile (fetch): ${error.message}`
    );
  }
};
var mapProfileToUserInfo = (profileData, providerUsername) => {
  const org = profileData.organization || {};
  const addr = org.address || {};
  const mappedData = {
    username: providerUsername || profileData.username,
    firstname: profileData.firstname_th || null,
    lastname: profileData.lastname_th || null,
    email: null,
    department: org.position || null,
    company: org.hname_th || null,
    workphone: null,
    homephone: null,
    mobilephone: null,
    address: addr.address ? `${addr.address} \u0E2B\u0E21\u0E39\u0E48 ${addr.moo || "-"} \u0E0B. ${addr.soi || "-"} \u0E16. ${addr.street || "-"}`.replace(/หมู่ - |ซ. - |ถ. - /g, "").trim() : null,
    city: addr.district || null,
    state: addr.province || null,
    country: addr.province ? "Thailand" : null,
    zip: addr.zip_code || null,
    notes: `Provider ID: ${profileData.provider_id || "N/A"}`,
    portalloginpassword: "",
    enableportallogin: 1,
    updateby: "OAuthCallback",
    changeuserinfo: null,
    // ปล่อยเป็น default
    creationdate: null,
    creationby: null,
    updatedate: null,
    providerData: JSON.stringify(profileData)
  };
  const validation = MappedUserInfoSchema.safeParse(mappedData);
  if (!validation.success) {
    logger.warn(
      {
        action: "oauth_map_profile",
        data: { validationErrors: validation.error.flatten() }
      },
      "[OAuth Callback] Data mapping resulted in validation errors"
    );
    return mappedData;
  }
  return validation.data;
};

// server/routes.ts
async function registerRoutes(app2) {
  app2.post("/api/authenticate", async (req, res) => {
    const { username, password } = req.body;
    logger.info({ action: "authenticate", data: { username } }, "[API] Received authentication request");
    try {
      const result = await authenticateUser(username, password);
      if (result.success) {
        logger.info({ action: "authenticate", data: { username } }, "[API] Authentication successful");
        const user = await findUserinfo(username);
        if (user) {
          createSession(user, res);
        }
        return res.status(200).json({
          ...result,
          data: user,
          sessionTimeoutMs: SESSION_TIMEOUT_MS
        });
      } else {
        logger.warn(
          {
            action: "authenticate",
            data: { username, reason: result.message }
          },
          "[API] Authentication failed"
        );
        return res.status(401).json(result);
      }
    } catch (error) {
      logger.error(
        { action: "authenticate", data: { username }, err: error },
        "[API] Internal error during authentication"
      );
      return res.status(500).json({
        success: false,
        message: "An internal server error occurred during authentication."
      });
    }
  });
  app2.post("/api/oauth/authorize_url", (req, res) => {
    const authorizationUrl = generateAuthorizeUrl();
    logger.info(
      {
        action: "oauth_authorize_url",
        // Query string holds the anti-CSRF `state`, so only the base URL is logged.
        data: { authorizeUrl: authorizationUrl.split("?")[0] }
      },
      "[OAuth] Generated authorization URL"
    );
    res.status(200).json({
      success: true,
      data: { authorizeUrl: authorizationUrl }
    });
  });
  app2.post("/api/oauth/callback", validate({ body: CallBackSchema }), async (req, res) => {
    const { code, state } = req.body;
    logger.info({ action: "oauth_callback" }, "[OAuth Callback] Received callback");
    if (typeof state !== "string" || !verifyAndConsumeState(state)) {
      return res.status(400).send("Invalid or expired state parameter.");
    }
    if (!code || typeof code !== "string") {
      return res.status(400).send("Authorization code missing.");
    }
    try {
      const healthIdToken = await exchangeHealthIdCodeForToken(code);
      const providerTokenInfo = await exchangeHealthIdTokenForProviderToken(healthIdToken);
      const providerAccessToken = providerTokenInfo.access_token;
      const providerUsername = providerTokenInfo.username;
      const profileData = await fetchProviderProfile(providerAccessToken);
      logger.info(
        {
          action: "oauth_callback",
          data: {
            // The provider token itself is a secret, so only non-sensitive
            // fields are logged.
            username: providerTokenInfo.username,
            accountId: providerTokenInfo.account_id,
            profileData
          }
        },
        "[OAuth Callback] Fetched provider profile"
      );
      const existingUser = await findUserinfo(providerUsername);
      const userInfo = mapProfileToUserInfo(profileData, providerUsername);
      let password = profileData.provider_id;
      if (existingUser) {
        logger.info(
          { action: "oauth_callback", data: { userId: existingUser.id } },
          "[OAuth Callback] Existing user found; updating user info"
        );
        await updateUserInfo(existingUser.id, userInfo);
        logger.info(
          { action: "oauth_callback", data: { userId: existingUser.id } },
          "[OAuth Callback] User updated successfully"
        );
        const user = await findUser(userInfo.username);
        if (user) {
          password = user.value;
        }
      } else {
        logger.info({ action: "oauth_callback" }, "[OAuth Callback] User not found; creating new user");
        const newUserId = await insertUserWithRadius(userInfo, password);
        logger.info({ action: "oauth_callback", data: { userId: newUserId } }, "[OAuth Callback] Created new user");
      }
      logger.info({ action: "oauth_callback" }, "[OAuth Callback] Process completed successfully");
      const sessionUser = await findUserinfo(userInfo.username);
      if (sessionUser) {
        createSession(sessionUser, res);
      }
      res.status(200).json({
        success: true,
        message: "Authentication and user sync successful.",
        providerId: profileData.provider_id,
        data: {
          ...userInfo,
          password
        },
        sessionTimeoutMs: SESSION_TIMEOUT_MS
      });
    } catch (error) {
      logger.error({ action: "oauth_callback", err: error }, "[OAuth Callback] Error processing callback");
      res.status(500).send(`An error occurred during authentication: ${error.message}`);
    }
  });
  app2.post("/api/oauth/callback-test", validate({ body: CallBackSchema }), async (req, res) => {
    const { code, state } = req.body;
    const userInfo = await findUser("oak");
    logger.info({ action: "oauth_callback_test" }, "[OAuth Callback Test] Process completed successfully");
    res.status(200).json({
      success: true,
      message: "Authentication and user sync successful.",
      body: { code, state },
      data: userInfo
    });
  });
  app2.get("/api/user", async (req, res) => {
    const session = getSession(req);
    if (session) {
      return res.status(200).json(session.user);
    }
    if (SESSION_IP_FALLBACK_ENABLED) {
      const clientIp = getClientIp(req);
      if (clientIp) {
        const radiusSession = await findActiveRadiusSessionByFramedIp(clientIp);
        if (radiusSession && isRadiusStartWithinTimeout(radiusSession.acctstarttime)) {
          const user = await findUserinfo(radiusSession.username);
          if (user) {
            createSession(user, res);
            logger.info(
              {
                action: "session_ip_fallback",
                data: { username: user.username, recoveredVia: "framed-ip" }
              },
              `[Session] Recovered web session for user: ${user.username} via framed IP.`
            );
            return res.status(200).json(user);
          }
        }
      }
    }
    return res.status(401).json({ success: false, message: "Unauthorized" });
  });
  const handleLogout = async (req, res) => {
    const sessionUser = peekSession(req)?.user ?? null;
    let coaResult = null;
    logger.info(
      { action: "logout_coa", data: { username: sessionUser?.username } },
      "[Logout] Attempting RADIUS CoA for user"
    );
    if (sessionUser) {
      const activeSession = await findActiveRadiusSession(sessionUser.username);
      if (activeSession && activeSession.nasipaddress) {
        coaResult = await performCoA(activeSession);
      } else {
        logger.info(
          { action: "logout_coa", data: { username: sessionUser.username } },
          `[Logout] No active RADIUS session found for ${sessionUser.username}; skipping CoA.`
        );
      }
    }
    destroySession(req, res);
    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
      data: coaResult
    });
  };
  app2.post("/api/logout", (req, res) => {
    void handleLogout(req, res);
  });
  app2.get("/api/logout", (req, res) => {
    void handleLogout(req, res);
  });
  const httpServer = createServer(app2);
  return httpServer;
}
var performCoA = async (activeSession) => {
  const username = activeSession.username;
  try {
    const nasSecret = await findNasSecret(activeSession.nasipaddress);
    const coaResult = await disconnectUser({
      username,
      nasipaddress: activeSession.nasipaddress,
      acctsessionid: activeSession.acctsessionid,
      callingstationid: activeSession.callingstationid,
      secret: nasSecret ?? void 0
    });
    logger.info({ action: "logout_coa", data: { username, coaResult } }, "[Logout] RADIUS CoA result");
    return coaResult;
  } catch (error) {
    logger.warn({ action: "logout_coa", data: { username, reason: error.message } }, "[Logout] RADIUS CoA failed");
    return null;
  }
};
var sweeperStarted = false;
var SESSION_SWEEPER_ENABLED = /^(true|1|yes|on)$/i.test(
  (process.env.SESSION_SWEEPER_ENABLED || "false").trim()
);
function startSessionSweeper() {
  if (!SESSION_SWEEPER_ENABLED) {
    logger.info(
      { action: "session_sweeper", data: { enabled: false } },
      "[Sweeper] Disabled via SESSION_SWEEPER_ENABLED=false; skipping."
    );
    return;
  }
  if (sweeperStarted) return;
  sweeperStarted = true;
  const intervalSeconds = parseInt(process.env.SESSION_SWEEP_INTERVAL_SECONDS || "60", 10);
  const intervalMs = Math.max(intervalSeconds, 1) * 1e3;
  setInterval(async () => {
    pruneSessions();
    const expiredSessions = await findExpiredRadiusSessions(SESSION_TIMEOUT_HOURS);
    if (expiredSessions.length === 0) {
      logger.info(
        {
          action: "session_sweeper",
          data: { expiredCount: 0 }
        },
        "[Sweeper] No expired RADIUS sessions found (timeout enforced server-side)."
      );
      return;
    }
    logger.info(
      {
        action: "session_sweeper",
        data: { expiredCount: expiredSessions.length }
      },
      `[Sweeper] Handling ${expiredSessions.length} expired RADIUS session(s) (timeout enforced server-side).`
    );
    for (const activeSession of expiredSessions) {
      await performCoA(activeSession);
      deleteSessionsByUsername(activeSession.username);
    }
  }, intervalMs);
  logger.info(
    {
      action: "session_sweeper",
      data: { intervalSeconds, timeoutHours: SESSION_TIMEOUT_HOURS }
    },
    `[Sweeper] Session timeout sweeper started (every ${intervalSeconds}s, timeout ${SESSION_TIMEOUT_HOURS}h measured from radacct.acctstarttime).`
  );
}

// server/static.ts
import express from "express";
import fs from "fs";
import path from "path";
function serveStatic(app2) {
  const distPath = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path2 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path2.startsWith("/api")) {
      logger.info(
        {
          source: "express",
          method: req.method,
          path: path2,
          status: res.statusCode,
          durationMs: duration,
          ...capturedJsonResponse ? { response: capturedJsonResponse } : {}
        },
        `${req.method} ${path2} ${res.statusCode} in ${duration}ms`
      );
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  startSessionSweeper();
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = process.env.EXPRESS_SERVER_PORT || "5000";
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true
    },
    () => {
      logger.info({ source: "express", port }, `serving on port ${port}`);
    }
  );
})();
