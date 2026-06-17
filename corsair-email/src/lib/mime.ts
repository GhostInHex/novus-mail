import { toBase64Url } from "@/lib/utils";

type MimeInput = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
};

export function buildMimeMessage(input: MimeInput) {
  const headers = [
    `From: ${input.from}`,
    `To: ${input.to.join(", ")}`,
    input.cc?.length ? `Cc: ${input.cc.join(", ")}` : null,
    input.bcc?.length ? `Bcc: ${input.bcc.join(", ")}` : null,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ].filter(Boolean);

  return toBase64Url(`${headers.join("\r\n")}\r\n\r\n${input.body}`);
}
