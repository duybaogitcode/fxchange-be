import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

import { BadRequestGraphQLError, GraphQLErrorResponse } from '@src/graphql/error';
import prisma from '@src/libs/prisma';
import { rollbar } from '@src/server';

dotenv.config();

interface InputEmail {
  to: string;
  subject: string;
  name: string;
  targetUrl: string;
  content: string;
}

class EmailService {
  public async sendEmail(input: InputEmail) {
    console.log(input.to);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.KEYEMAIL,
      },
    });

    try {
      const mailOptions = {
        from: 'baod66397@gmail.com',
        to: input.to,
        subject: input.subject,
        html: `
        <!DOCTYPE html>
<html
  xmlns="http://www.w3.org/1999/xhtml"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
>
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Gmail FXChange</title>

    <style type="text/css">
      p {
        margin: 10px 0;
        padding: 0;
      }

      table {
        border-collapse: collapse;
      }

      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        display: block;
        margin: 0;
        padding: 0;
      }

      img,
      a img {
        border: 0;
        height: auto;
        outline: none;
        text-decoration: none;
      }

      body,
      #bodyTable,
      #bodyCell {
        height: 100%;
        margin: 0;
        padding: 0;
        width: 100%;
      }

      .mcnPreviewText {
        display: none !important;
      }

      #outlook a {
        padding: 0;
      }

      img {
        -ms-interpolation-mode: bicubic;
      }

      .ReadMsgBody {
        width: 100%;
      }

      .ExternalClass {
        width: 100%;
      }

      a[href^='tel'],
      a[href^='sms'] {
        color: inherit;
        cursor: default;
        text-decoration: none;
      }

      p,
      a,
      li,
      td,
      body,
      table,
      blockquote {
        -ms-text-size-adjust: 100%;
        -webkit-text-size-adjust: 100%;
      }

      .ExternalClass,
      .ExternalClass p,
      .ExternalClass td,
      .ExternalClass div,
      .ExternalClass span,
      .ExternalClass font {
        line-height: 100%;
      }

      a[x-apple-data-detectors] {
        color: inherit !important;
        text-decoration: none !important;
        font-size: inherit !important;
        font-family: inherit !important;
        font-weight: inherit !important;
        line-height: inherit !important;
      }

      .templateContainer {
        max-width: 600px !important;
      }

      a.mcnButton {
        display: block;
      }

      .mcnImage,
      .mcnRetinaImage {
        vertical-align: bottom;
      }

      .mcnTextContent {
        word-break: break-word;
      }

      .mcnTextContent img {
        height: auto !important;
      }

      .mcnDividerBlock {
        table-layout: fixed !important;
      }

      /*
	@tab Page
	@section Heading 1
	@style heading 1
	*/
      h1 {
        color: #222222;
        font-family: Helvetica;
        font-size: 40px;
        font-style: normal;
        font-weight: bold;
        line-height: 150%;
        letter-spacing: normal;
        text-align: center;
      }

      /*
	@tab Page
	@section Heading 2
	@style heading 2
	*/
      h2 {
        color: #222222;
        font-family: Helvetica;
        font-size: 34px;
        font-style: normal;
        font-weight: bold;
        line-height: 150%;
        letter-spacing: normal;
        text-align: left;
      }

      /*
	@tab Page
	@section Heading 3
	@style heading 3
	*/
      h3 {
        color: #444444;
        font-family: Helvetica;
        font-size: 22px;
        font-style: normal;
        font-weight: bold;
        line-height: 150%;
        letter-spacing: normal;
        text-align: left;
      }

      /*
	@tab Page
	@section Heading 4
	@style heading 4
	*/
      h4 {
        color: #949494;
        font-family: Georgia;
        font-size: 20px;
        font-style: italic;
        font-weight: normal;
        line-height: 125%;
        letter-spacing: normal;
        text-align: left;
      }

      /*
	@tab Header
	@section Header Container Style
	*/
      #templateHeader {
        background-color: #f7f7f7;
        background-image: none;
        background-repeat: no-repeat;
        background-position: 50% 50%;
        background-size: contain;
        border-top: 0;
        border-bottom: 0;
        padding-top: 45px;
        padding-bottom: 45px;
      }

      /*
	@tab Header
	@section Header Interior Style
	*/
      .headerContainer {
        background-color: transparent;
        background-image: none;
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;
        border-top: 0;
        border-bottom: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      /*
	@tab Header
	@section Header Text
	*/
      .headerContainer .mcnTextContent,
      .headerContainer .mcnTextContent p {
        color: #757575;
        font-family: Helvetica;
        font-size: 16px;
        line-height: 150%;
        text-align: left;
      }

      /*
	@tab Header
	@section Header Link
	*/
      .headerContainer .mcnTextContent a,
      .headerContainer .mcnTextContent p a {
        color: #007c89;
        font-weight: normal;
        text-decoration: underline;
      }

      /*
	@tab Body
	@section Body Container Style
	*/
      #templateBody {
        background-color: #f5f5f5;
        background-image: none;
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;
        border-top: 0;
        border-bottom: 0;
        padding-top: 36px;
        padding-bottom: 45px;
      }

      /*
	@tab Body
	@section Body Interior Style
	*/
      .bodyContainer {
        background-color: transparent;
        background-image: none;
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;
        border-top: 0;
        border-bottom: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      /*
	@tab Body
	@section Body Text
	*/
      .bodyContainer .mcnTextContent,
      .bodyContainer .mcnTextContent p {
        color: #757575;
        font-family: Helvetica;
        font-size: 16px;
        line-height: 150%;
        text-align: left;
      }

      /*
	@tab Body
	@section Body Link
	*/
      .bodyContainer .mcnTextContent a,
      .bodyContainer .mcnTextContent p a {
        color: #007c89;
        font-weight: normal;
        text-decoration: underline;
      }

      /*
	@tab Footer
	@section Footer Style
	*/
      #templateFooter {
        background-color: #333333;
        background-image: none;
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;
        border-top: 0;
        border-bottom: 0;
        padding-top: 45px;
        padding-bottom: 63px;
      }

      /*
	@tab Footer
	@section Footer Interior Style
	*/
      .footerContainer {
        background-color: transparent;
        background-image: none;
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;
        border-top: 0;
        border-bottom: 0;
        padding-top: 0;
        padding-bottom: 0;
      }

      /*
	@tab Footer
	@section Footer Text
	*/
      .footerContainer .mcnTextContent,
      .footerContainer .mcnTextContent p {
        color: #ffffff;
        font-family: Helvetica;
        font-size: 12px;
        line-height: 150%;
        text-align: center;
      }

      /*
	@tab Footer
	@section Footer Link
	*/
      .footerContainer .mcnTextContent a,
      .footerContainer .mcnTextContent p a {
        color: #ffffff;
        font-weight: normal;
        text-decoration: underline;
      }

      @media only screen and (min-width: 768px) {
        .templateContainer {
          width: 600px !important;
        }
      }

      @media only screen and (max-width: 480px) {
        body,
        table,
        td,
        p,
        a,
        li,
        blockquote {
          -webkit-text-size-adjust: none !important;
        }
      }

      @media only screen and (max-width: 480px) {
        body {
          width: 100% !important;
          min-width: 100% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnRetinaImage {
          max-width: 100% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnImage {
          width: 100% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnCartContainer,
        .mcnCaptionTopContent,
        .mcnRecContentContainer,
        .mcnCaptionBottomContent,
        .mcnTextContentContainer,
        .mcnBoxedTextContentContainer,
        .mcnImageGroupContentContainer,
        .mcnCaptionLeftTextContentContainer,
        .mcnCaptionRightTextContentContainer,
        .mcnCaptionLeftImageContentContainer,
        .mcnCaptionRightImageContentContainer,
        .mcnImageCardLeftTextContentContainer,
        .mcnImageCardRightTextContentContainer,
        .mcnImageCardLeftImageContentContainer,
        .mcnImageCardRightImageContentContainer {
          max-width: 100% !important;
          width: 100% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnBoxedTextContentContainer {
          min-width: 100% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnImageGroupContent {
          padding: 9px !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnCaptionLeftContentOuter .mcnTextContent,
        .mcnCaptionRightContentOuter .mcnTextContent {
          padding-top: 9px !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnImageCardTopImageContent,
        .mcnCaptionBottomContent:last-child .mcnCaptionBottomImageContent,
        .mcnCaptionBlockInner .mcnCaptionTopContent:last-child .mcnTextContent {
          padding-top: 18px !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnImageCardBottomImageContent {
          padding-bottom: 9px !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnImageGroupBlockInner {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnImageGroupBlockOuter {
          padding-top: 9px !important;
          padding-bottom: 9px !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnTextContent,
        .mcnBoxedTextContentColumn {
          padding-right: 18px !important;
          padding-left: 18px !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcnImageCardLeftImageContent,
        .mcnImageCardRightImageContent {
          padding-right: 18px !important;
          padding-bottom: 0 !important;
          padding-left: 18px !important;
        }
      }

      @media only screen and (max-width: 480px) {
        .mcpreview-image-uploader {
          display: none !important;
          width: 100% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        /*
	@tab Mobile Styles
	@section Heading 1
	@tip Make the first-level headings larger in size for better readability on small screens.
	*/
        h1 {
          font-size: 30px !important;
          line-height: 125% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        /*
	@tab Mobile Styles
	@section Heading 2
	@tip Make the second-level headings larger in size for better readability on small screens.
	*/
        h2 {
          font-size: 26px !important;
          line-height: 125% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        /*
	@tab Mobile Styles
	@section Heading 3
	@tip Make the third-level headings larger in size for better readability on small screens.
	*/
        h3 {
          font-size: 20px !important;
          line-height: 150% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        /*
	@tab Mobile Styles
	@section Heading 4
	@tip Make the fourth-level headings larger in size for better readability on small screens.
	*/
        h4 {
          font-size: 18px !important;
          line-height: 150% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        /*
	@tab Mobile Styles
	@section Boxed Text
	@tip Make the boxed text larger in size for better readability on small screens. We recommend a font size of at least 16px.
	*/
        .mcnBoxedTextContentContainer .mcnTextContent,
        .mcnBoxedTextContentContainer .mcnTextContent p {
          font-size: 14px !important;
          line-height: 150% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        /*
	@tab Mobile Styles
	@section Header Text
	@tip Make the header text larger in size for better readability on small screens.
	*/
        .headerContainer .mcnTextContent,
        .headerContainer .mcnTextContent p {
          font-size: 16px !important;
          line-height: 150% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        /*
	@tab Mobile Styles
	@section Body Text
	@tip Make the body text larger in size for better readability on small screens. We recommend a font size of at least 16px.
	*/
        .bodyContainer .mcnTextContent,
        .bodyContainer .mcnTextContent p {
          font-size: 16px !important;
          line-height: 150% !important;
        }
      }

      @media only screen and (max-width: 480px) {
        /*
	@tab Mobile Styles
	@section Footer Text
	@tip Make the footer content text larger in size for better readability on small screens.
	*/
        .footerContainer .mcnTextContent,
        .footerContainer .mcnTextContent p {
          font-size: 14px !important;
          line-height: 150% !important;
        }
      }
    </style>
  </head>

  <body>
    <span
      class="mcnPreviewText"
      style="
        display: none;
        font-size: 0px;
        line-height: 0px;
        max-height: 0px;
        max-width: 0px;
        opacity: 0;
        overflow: hidden;
        visibility: hidden;
      "
      >*|MC_PREVIEW_TEXT|*</span
    >
    <center>
      <table
        align="center"
        border="0"
        cellpadding="0"
        cellspacing="0"
        height="100%"
        width="100%"
        id="bodyTable"
      >
        <tr>
          <td align="center" valign="top" id="bodyCell">
            <!-- BEGIN TEMPLATE // -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" valign="top" id="templateHeader" data-template-container>
                  <table
                    align="center"
                    border="0"
                    cellpadding="0"
                    cellspacing="0"
                    width="100%"
                    class="templateContainer"
                  >
                    <tr>
                      <td valign="top" class="headerContainer">
                        <table
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          class="mcnCaptionBlock"
                        >
                          <tbody class="mcnCaptionBlockOuter">
                            <tr>
                              <td class="mcnCaptionBlockInner" valign="top" style="padding: 9px">
                                <table
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  class="mcnCaptionRightContentOuter"
                                  width="100%"
                                >
                                  <tbody>
                                    <tr>
                                      <td
                                        valign="top"
                                        class="mcnCaptionRightContentInner"
                                        style="padding: 0 9px"
                                      >
                                        <table
                                          align="left"
                                          border="0"
                                          cellpadding="0"
                                          cellspacing="0"
                                          class="mcnCaptionRightImageContentContainer"
                                          width="132"
                                        >
                                          <tbody>
                                            <tr>
                                              <td
                                                class="mcnCaptionRightImageContent"
                                                align="left"
                                                valign="top"
                                              >
                                                <!-- logo -->
                                                <img
                                                  alt=""
                                                  src="https://mcusercontent.com/99c1ccf9eb35e3236cd0c6bf9/images/4df34df9-c549-07d0-fa3d-1e436503c727.png"
                                                  width="77"
                                                  style="
                                                    max-width: 77px;
                                                    border: 1px none;
                                                    border-radius: 0%;
                                                  "
                                                  class="mcnImage"
                                                />
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                        <!-- Notification -->
                                        <table
                                          class="mcnCaptionRightTextContentContainer"
                                          align="right"
                                          border="0"
                                          cellpadding="0"
                                          cellspacing="0"
                                          width="396"
                                        >
                                          <tbody>
                                            <tr>
                                              <td
                                                valign="top"
                                                class="mcnTextContent"
                                                style="line-height: 100%; text-align: center"
                                              >
                                                <h1 class="null" style="text-align: center">
                                                  <span style="font-size: 36px"
                                                    ><span style="color: #000000"
                                                      ><strong> Thông báo đơn hàng</strong></span
                                                    ></span
                                                  >
                                                </h1>
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" valign="top" id="templateBody" data-template-container>
                  <table
                    align="center"
                    border="0"
                    cellpadding="0"
                    cellspacing="0"
                    width="100%"
                    class="templateContainer"
                  >
                    <tr>
                      <td valign="top" class="bodyContainer">
                        <table
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          class="mcnTextBlock"
                          style="min-width: 100%"
                        >
                          <tbody class="mcnTextBlockOuter">
                            <tr>
                              <td valign="top" class="mcnTextBlockInner" style="padding-top: 9px">
                                <!-- nội dung thông báo -->
                                <table
                                  align="left"
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  style="max-width: 100%; min-width: 100%"
                                  width="100%"
                                  class="mcnTextContentContainer"
                                >
                                  <tbody>
                                    <tr>
                                      <td
                                        valign="top"
                                        class="mcnTextContent"
                                        style="padding: 0px 18px 9px; color: #222222"
                                      >
                                        <h3>Xin chào ${input.name}&nbsp;,</h3>

                                        <p style="color: #222222">
                                          ${input.content}
                                        </p>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <!-- Món hàng -->
                        <table
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          class="mcnCaptionBlock"
                        >
                          <tbody class="mcnCaptionBlockOuter">
                            <tr>
                              <td class="mcnCaptionBlockInner" valign="top" style="padding: 9px">
                                <table
                                  align="left"
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  class="mcnCaptionBottomContent"
                                >
                                  <tbody>
                                    <tr>
                                      <td
                                        class="mcnCaptionBottomImageContent"
                                        align="center"
                                        valign="top"
                                        style="padding: 0 9px 9px 9px"
                                      >
                                        <img
                                          alt=""
                                          src="https://mcusercontent.com/99c1ccf9eb35e3236cd0c6bf9/images/d01330a6-6e46-7df0-f982-1b8166dbafe2.png"
                                          width="257"
                                          style="max-width: 257px; display: none"
                                          class="mcnImage"
                                        />
                                      </td>
                                    </tr>
                                    <tr>
                                      <td
                                        class="mcnTextContent"
                                        valign="top"
                                        style="padding: 0 9px 0 9px"
                                        width="564"
                                      >
                                        &nbsp;
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        <table
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          class="mcnDividerBlock"
                          style="min-width: 100%"
                        >
                          <tbody class="mcnDividerBlockOuter">
                            <tr>
                              <td
                                class="mcnDividerBlockInner"
                                style="min-width: 100%; padding: 18px"
                              >
                                <table
                                  class="mcnDividerContent"
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  width="100%"
                                  style="min-width: 100%"
                                >
                                  <tbody>
                                    <tr>
                                      <td>
                                        <span></span>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          class="mcnButtonBlock"
                          style="min-width: 100%"
                        >
                          <tbody class="mcnButtonBlockOuter">
                            <tr>
                              <td
                                style="
                                  padding-top: 0;
                                  padding-right: 18px;
                                  padding-bottom: 18px;
                                  padding-left: 18px;
                                "
                                valign="top"
                                align="center"
                                class="mcnButtonBlockInner"
                              >
                                <table
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  class="mcnButtonContentContainer"
                                  style="
                                    border-collapse: separate !important;
                                    border: 1px none;
                                    border-radius: 8px;
                                    background-color: #334155;
                                  "
                                >
                                  <tbody>
                                    <tr>
                                      <td
                                        align="center"
                                        valign="middle"
                                        class="mcnButtonContent"
                                        style="
                                          font-family: Roboto, Helvetica Neue, Helvetica, Arial,
                                            sans-serif;
                                          font-size: 24px;
                                          padding: 18px;
                                        "
                                      >
                                        <a
                                          class="mcnButton"
                                          title="Go to Page"
                                          href="${input.targetUrl}"
                                          target="_blank"
                                          style="
                                            font-weight: bold;
                                            letter-spacing: 1px;
                                            line-height: 100%;
                                            text-align: center;
                                            text-decoration: none;
                                            color: #ffffff;
                                          "
                                          >Go to Page</a
                                        >
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" valign="top" id="templateFooter" data-template-container>
                  <table
                    align="center"
                    border="0"
                    cellpadding="0"
                    cellspacing="0"
                    width="100%"
                    class="templateContainer"
                  >
                    <tr>
                      <td valign="top" class="footerContainer">
                        <table
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          class="mcnFollowBlock"
                          style="min-width: 100%"
                        >
                          <tbody class="mcnFollowBlockOuter">
                            <tr>
                              <td
                                align="center"
                                valign="top"
                                style="padding: 9px"
                                class="mcnFollowBlockInner"
                              >
                                <table
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  width="100%"
                                  class="mcnFollowContentContainer"
                                  style="min-width: 100%"
                                >
                                  <tbody>
                                    <tr>
                                      <td
                                        align="center"
                                        style="padding-left: 9px; padding-right: 9px"
                                      >
                                        <table
                                          border="0"
                                          cellpadding="0"
                                          cellspacing="0"
                                          width="100%"
                                          style="min-width: 100%"
                                          class="mcnFollowContent"
                                        >
                                          <tbody>
                                            <tr>
                                              <td
                                                align="center"
                                                valign="top"
                                                style="
                                                  padding-top: 9px;
                                                  padding-right: 9px;
                                                  padding-left: 9px;
                                                "
                                              >
                                                <table
                                                  align="center"
                                                  border="0"
                                                  cellpadding="0"
                                                  cellspacing="0"
                                                >
                                                  <tbody>
                                                    <tr>
                                                      <td align="center" valign="top">
                                                        <table
                                                          align="left"
                                                          border="0"
                                                          cellpadding="0"
                                                          cellspacing="0"
                                                          style="display: inline"
                                                        >
                                                          <tbody>
                                                            <tr>
                                                              <td
                                                                valign="top"
                                                                style="
                                                                  padding-right: 10px;
                                                                  padding-bottom: 9px;
                                                                "
                                                                class="mcnFollowContentItemContainer"
                                                              >
                                                                <table
                                                                  border="0"
                                                                  cellpadding="0"
                                                                  cellspacing="0"
                                                                  width="100%"
                                                                  class="mcnFollowContentItem"
                                                                >
                                                                  <tbody>
                                                                    <tr>
                                                                      <td
                                                                        align="left"
                                                                        valign="middle"
                                                                        style="
                                                                          padding-top: 5px;
                                                                          padding-right: 10px;
                                                                          padding-bottom: 5px;
                                                                          padding-left: 9px;
                                                                        "
                                                                      >
                                                                        <table
                                                                          align="left"
                                                                          border="0"
                                                                          cellpadding="0"
                                                                          cellspacing="0"
                                                                          width=""
                                                                        >
                                                                          <tbody>
                                                                            <tr>
                                                                              <td
                                                                                align="center"
                                                                                valign="middle"
                                                                                width="24"
                                                                                class="mcnFollowIconContent"
                                                                              >
                                                                                <a
                                                                                  href="http://www.facebook.com"
                                                                                  target="_blank"
                                                                                  ><img
                                                                                    src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-facebook-48.png"
                                                                                    alt="Facebook"
                                                                                    style="
                                                                                      display: block;
                                                                                    "
                                                                                    height="24"
                                                                                    width="24"
                                                                                    class=""
                                                                                /></a>
                                                                              </td>
                                                                            </tr>
                                                                          </tbody>
                                                                        </table>
                                                                      </td>
                                                                    </tr>
                                                                  </tbody>
                                                                </table>
                                                              </td>
                                                            </tr>
                                                          </tbody>
                                                        </table>

                                                        <table
                                                          align="left"
                                                          border="0"
                                                          cellpadding="0"
                                                          cellspacing="0"
                                                          style="display: inline"
                                                        >
                                                          <tbody>
                                                            <tr>
                                                              <td
                                                                valign="top"
                                                                style="
                                                                  padding-right: 10px;
                                                                  padding-bottom: 9px;
                                                                "
                                                                class="mcnFollowContentItemContainer"
                                                              >
                                                                <table
                                                                  border="0"
                                                                  cellpadding="0"
                                                                  cellspacing="0"
                                                                  width="100%"
                                                                  class="mcnFollowContentItem"
                                                                >
                                                                  <tbody>
                                                                    <tr>
                                                                      <td
                                                                        align="left"
                                                                        valign="middle"
                                                                        style="
                                                                          padding-top: 5px;
                                                                          padding-right: 10px;
                                                                          padding-bottom: 5px;
                                                                          padding-left: 9px;
                                                                        "
                                                                      >
                                                                        <table
                                                                          align="left"
                                                                          border="0"
                                                                          cellpadding="0"
                                                                          cellspacing="0"
                                                                          width=""
                                                                        >
                                                                          <tbody>
                                                                            <tr>
                                                                              <td
                                                                                align="center"
                                                                                valign="middle"
                                                                                width="24"
                                                                                class="mcnFollowIconContent"
                                                                              >
                                                                                <a
                                                                                  href="http://www.twitter.com/"
                                                                                  target="_blank"
                                                                                  ><img
                                                                                    src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-twitter-48.png"
                                                                                    alt="Twitter"
                                                                                    style="
                                                                                      display: block;
                                                                                    "
                                                                                    height="24"
                                                                                    width="24"
                                                                                    class=""
                                                                                /></a>
                                                                              </td>
                                                                            </tr>
                                                                          </tbody>
                                                                        </table>
                                                                      </td>
                                                                    </tr>
                                                                  </tbody>
                                                                </table>
                                                              </td>
                                                            </tr>
                                                          </tbody>
                                                        </table>

                                                        <table
                                                          align="left"
                                                          border="0"
                                                          cellpadding="0"
                                                          cellspacing="0"
                                                          style="display: inline"
                                                        >
                                                          <tbody>
                                                            <tr>
                                                              <td
                                                                valign="top"
                                                                style="
                                                                  padding-right: 10px;
                                                                  padding-bottom: 9px;
                                                                "
                                                                class="mcnFollowContentItemContainer"
                                                              >
                                                                <table
                                                                  border="0"
                                                                  cellpadding="0"
                                                                  cellspacing="0"
                                                                  width="100%"
                                                                  class="mcnFollowContentItem"
                                                                >
                                                                  <tbody>
                                                                    <tr>
                                                                      <td
                                                                        align="left"
                                                                        valign="middle"
                                                                        style="
                                                                          padding-top: 5px;
                                                                          padding-right: 10px;
                                                                          padding-bottom: 5px;
                                                                          padding-left: 9px;
                                                                        "
                                                                      >
                                                                        <table
                                                                          align="left"
                                                                          border="0"
                                                                          cellpadding="0"
                                                                          cellspacing="0"
                                                                          width=""
                                                                        >
                                                                          <tbody>
                                                                            <tr>
                                                                              <td
                                                                                align="center"
                                                                                valign="middle"
                                                                                width="24"
                                                                                class="mcnFollowIconContent"
                                                                              >
                                                                                <a
                                                                                  href="http://www.instagram.com/"
                                                                                  target="_blank"
                                                                                  ><img
                                                                                    src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-instagram-48.png"
                                                                                    alt="Link"
                                                                                    style="
                                                                                      display: block;
                                                                                    "
                                                                                    height="24"
                                                                                    width="24"
                                                                                    class=""
                                                                                /></a>
                                                                              </td>
                                                                            </tr>
                                                                          </tbody>
                                                                        </table>
                                                                      </td>
                                                                    </tr>
                                                                  </tbody>
                                                                </table>
                                                              </td>
                                                            </tr>
                                                          </tbody>
                                                        </table>

                                                        <table
                                                          align="left"
                                                          border="0"
                                                          cellpadding="0"
                                                          cellspacing="0"
                                                          style="display: inline"
                                                        >
                                                          <tbody>
                                                            <tr>
                                                              <td
                                                                valign="top"
                                                                style="
                                                                  padding-right: 0;
                                                                  padding-bottom: 9px;
                                                                "
                                                                class="mcnFollowContentItemContainer"
                                                              >
                                                                <table
                                                                  border="0"
                                                                  cellpadding="0"
                                                                  cellspacing="0"
                                                                  width="100%"
                                                                  class="mcnFollowContentItem"
                                                                >
                                                                  <tbody>
                                                                    <tr>
                                                                      <td
                                                                        align="left"
                                                                        valign="middle"
                                                                        style="
                                                                          padding-top: 5px;
                                                                          padding-right: 10px;
                                                                          padding-bottom: 5px;
                                                                          padding-left: 9px;
                                                                        "
                                                                      >
                                                                        <table
                                                                          align="left"
                                                                          border="0"
                                                                          cellpadding="0"
                                                                          cellspacing="0"
                                                                          width=""
                                                                        >
                                                                          <tbody>
                                                                            <tr>
                                                                              <td
                                                                                align="center"
                                                                                valign="middle"
                                                                                width="24"
                                                                                class="mcnFollowIconContent"
                                                                              >
                                                                                <a
                                                                                  href="http://mailchimp.com"
                                                                                  target="_blank"
                                                                                  ><img
                                                                                    src="https://cdn-images.mailchimp.com/icons/social-block-v2/outline-light-link-48.png"
                                                                                    alt="Website"
                                                                                    style="
                                                                                      display: block;
                                                                                    "
                                                                                    height="24"
                                                                                    width="24"
                                                                                    class=""
                                                                                /></a>
                                                                              </td>
                                                                            </tr>
                                                                          </tbody>
                                                                        </table>
                                                                      </td>
                                                                    </tr>
                                                                  </tbody>
                                                                </table>
                                                              </td>
                                                            </tr>
                                                          </tbody>
                                                        </table>
                                                      </td>
                                                    </tr>
                                                  </tbody>
                                                </table>
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          class="mcnDividerBlock"
                          style="min-width: 100%"
                        >
                          <tbody class="mcnDividerBlockOuter">
                            <tr>
                              <td
                                class="mcnDividerBlockInner"
                                style="min-width: 100%; padding: 18px"
                              >
                                <table
                                  class="mcnDividerContent"
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  width="100%"
                                  style="min-width: 100%; border-top: 2px solid #505050"
                                >
                                  <tbody>
                                    <tr>
                                      <td>
                                        <span></span>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <table
                          border="0"
                          cellpadding="0"
                          cellspacing="0"
                          width="100%"
                          class="mcnTextBlock"
                          style="min-width: 100%"
                        >
                          <tbody class="mcnTextBlockOuter">
                            <tr>
                              <td valign="top" class="mcnTextBlockInner" style="padding-top: 9px">
                                <table
                                  align="left"
                                  border="0"
                                  cellpadding="0"
                                  cellspacing="0"
                                  style="max-width: 100%; min-width: 100%"
                                  width="100%"
                                  class="mcnTextContentContainer"
                                >
                                  <tbody>
                                    <tr>
                                      <td
                                        valign="top"
                                        class="mcnTextContent"
                                        style="
                                          padding-top: 0;
                                          padding-right: 18px;
                                          padding-bottom: 9px;
                                          padding-left: 18px;
                                        "
                                      >
                                        <em>Copyright ©2023 FXChange, All rights reserved.</em
                                        ><br />
                                        <br />
                                        <strong>Our mailing address is:</strong><br />
                                        &nbsp;Lô E2a-7, Đường D1, Đ. D1, Long Thạnh Mỹ, Thành Phố
                                        Thủ Đức, Thành phố Hồ Chí Minh<br />
                                        <br />
                                        Want to change how you receive these emails?<br />
                                        You can
                                        <a href="*|UPDATE_PROFILE|*">update your preferences</a> or
                                        <a href="*|UNSUB|*">unsubscribe from this list</a>.<br />
                                        &nbsp;
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </center>
    <script
      type="text/javascript"
      src="/IBaRcP8wd/AY5/O0e/DLAigai-Cb58/YkQupzS2DG/Ay9OAQ/F3J6Rwkt/Ynk"
    ></script>
  </body>
</html>

        `,
      };

      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error: ', error);
      rollbar.error('Error: ', error);
    }
  }
}

export default new EmailService();
