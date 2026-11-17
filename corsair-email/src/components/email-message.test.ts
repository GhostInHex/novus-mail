import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmailMessage } from "./email-message";
const message = {id:"m",from:"a@example.com",to:"b@example.com",subject:"HTML",snippet:"preview",body:"Plain alternative",htmlBody:"<strong>HTML alternative</strong>",receivedAt:null,labels:[]};
test("multipart mail renders HTML even when a plain text alternative exists", () => {
 const html=renderToStaticMarkup(createElement(EmailMessage,{message,renderHtml:()=>createElement("iframe",{title:"HTML message"})}));
 assert.match(html,/<iframe/);assert.doesNotMatch(html,/Plain alternative/);
});
test("plain mail keeps readable paragraphs",()=>{
 const html=renderToStaticMarkup(createElement(EmailMessage,{message:{...message,htmlBody:null,body:"First\n\nSecond"},renderHtml:()=>null}));
 assert.match(html,/<p>First<\/p><p>Second<\/p>/);
});
