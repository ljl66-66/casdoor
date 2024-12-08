// Copyright 2022 The Casdoor Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React from "react";
import {Button, Descriptions, InputNumber, Space, Spin} from "antd";
import i18next from "i18next";
import * as ProductBackend from "./backend/ProductBackend";
import * as PlanBackend from "./backend/PlanBackend";
import * as PricingBackend from "./backend/PricingBackend";
import * as Setting from "./Setting";

const formCssdefault = `<style>
    .login-content {
      align-items: center;
      box-sizing: border-box;
      display: flex;
      flex-direction: row;
      justify-content: center;
      margin: 0 auto;
      position: relative;
    }

    .product-title {
      font-size: 28px;
    }

    .product-name {
      font-size: 25px;
    }

    .product-detail, .product-tag, .product-sku {
      font-size: 16px;
    }

    .product-price {
      font-size: 28px;
      color: red;
      font-weight: bold;
    }

    .product-quantity, .product-sold {
      font-size: 16px;
    }
  </style>`;

class ProductBuyPage extends React.Component {
  constructor(props) {
    super(props);
    const params = new URLSearchParams(window.location.search);
    this.state = {
      classes: props,
      owner: props?.organizationName ?? props?.match?.params?.organizationName ?? props?.match?.params?.owner ?? null,
      productName: props?.productName ?? props?.match?.params?.productName ?? null,
      pricingName: props?.pricingName ?? props?.match?.params?.pricingName ?? null,
      planName: params.get("plan"),
      userName: params.get("user"),
      paymentEnv: "",
      product: null,
      pricing: props?.pricing ?? null,
      plan: null,
      isPlacingOrder: false,
      customPrice: 0,
      organization: null,
    };
  }

  getPaymentEnv() {
    let env = "";
    const ua = navigator.userAgent.toLocaleLowerCase();
    // Only support Wechat Pay in Wechat Browser for mobile devices
    if (ua.indexOf("micromessenger") !== -1 && ua.indexOf("mobile") !== -1) {
      env = "WechatBrowser";
    }
    this.setState({
      paymentEnv: env,
    });
  }

  UNSAFE_componentWillMount() {
    this.getProduct();
    this.getPaymentEnv();
  }

  setStateAsync(state) {
    return new Promise((resolve, reject) => {
      this.setState(state, () => {
        resolve();
      });
    });
  }

  onUpdatePricing(pricing) {
    this.props.onUpdatePricing(pricing);
  }

  async getProduct() {
    if (!this.state.owner || (!this.state.productName && !this.state.pricingName)) {
      return ;
    }
    try {
      // load pricing & plan
      if (this.state.pricingName) {
        if (!this.state.planName || !this.state.userName) {
          return ;
        }
        let res = await PricingBackend.getPricing(this.state.owner, this.state.pricingName);
        if (res.status !== "ok") {
          throw new Error(res.msg);
        }
        const pricing = res.data;
        res = await PlanBackend.getPlan(this.state.owner, this.state.planName);
        if (res.status !== "ok") {
          throw new Error(res.msg);
        }
        const plan = res.data;
        await this.setStateAsync({
          pricing: pricing,
          plan: plan,
          productName: plan.product,
        });
        this.onUpdatePricing(pricing);
      }
      // load product
      const res = await ProductBackend.getProduct(this.state.owner, this.state.productName);
      if (res.status !== "ok") {
        throw new Error(res.msg);
      }
      this.setState({
        product: res.data,
      });
    } catch (err) {
      Setting.showMessage("error", err.message);
      return;
    }
  }

  getProductObj() {
    if (this.props.product !== undefined) {
      return this.props.product;
    } else {
      return this.state.product;
    }
  }

  getCurrencySymbol(product) {
    if (product?.currency === "USD") {
      return "$";
    } else if (product?.currency === "CNY") {
      return "￥";
    } else if (product?.currency === "EUR") {
      return "€";
    } else if (product?.currency === "JPY") {
      return "¥";
    } else if (product?.currency === "GBP") {
      return "£";
    } else if (product?.currency === "AUD") {
      return "A$";
    } else if (product?.currency === "CAD") {
      return "C$";
    } else if (product?.currency === "CHF") {
      return "CHF";
    } else if (product?.currency === "HKD") {
      return "HK$";
    } else if (product?.currency === "SGD") {
      return "S$";
    } else {
      return "(Unknown currency)";
    }
  }

  getPrice(product) {
    return `${this.getCurrencySymbol(product)}${product?.price} (${Setting.getCurrencyText(product)})`;
  }

  // Call Weechat Pay via jsapi
  onBridgeReady(attachInfo) {
    const {WeixinJSBridge} = window;
    // Setting.showMessage("success", "attachInfo is " + JSON.stringify(attachInfo));
    this.setState({
      isPlacingOrder: false,
    });
    WeixinJSBridge.invoke(
      "getBrandWCPayRequest", {
        "appId": attachInfo.appId,
        "timeStamp": attachInfo.timeStamp,
        "nonceStr": attachInfo.nonceStr,
        "package": attachInfo.package,
        "signType": attachInfo.signType,
        "paySign": attachInfo.paySign,
      },
      function(res) {
        if (res.err_msg === "get_brand_wcpay_request:ok") {
          Setting.goToLink(attachInfo.payment.successUrl);
          return ;
        } else {
          if (res.err_msg === "get_brand_wcpay_request:cancel") {
            Setting.showMessage("error", i18next.t("product:Payment cancelled"));
          } else {
            Setting.showMessage("error", i18next.t("product:Payment failed"));
          }
        }
      }
    );
  }

  // In Wechat browser, call this function to pay via jsapi
  callWechatPay(attachInfo) {
    const {WeixinJSBridge} = window;
    if (typeof WeixinJSBridge === "undefined") {
      if (document.addEventListener) {
        document.addEventListener("WeixinJSBridgeReady", () => this.onBridgeReady(attachInfo), false);
      } else if (document.attachEvent) {
        document.attachEvent("WeixinJSBridgeReady", () => this.onBridgeReady(attachInfo));
        document.attachEvent("onWeixinJSBridgeReady", () => this.onBridgeReady(attachInfo));
      }
    } else {
      this.onBridgeReady(attachInfo);
    }
  }

  buyProduct(product, provider) {
    this.setState({
      isPlacingOrder: true,
    });

    ProductBackend.buyProduct(product.owner, product.name, provider.name, this.state.pricingName ?? "", this.state.planName ?? "", this.state.userName ?? "", this.state.paymentEnv, this.state.customPrice)
      .then((res) => {
        if (res.status === "ok") {
          const payment = res.data;
          const attachInfo = res.data2;
          let payUrl = payment.payUrl;
          if (provider.type === "WeChat Pay") {
            if (this.state.paymentEnv === "WechatBrowser") {
              attachInfo.payment = payment;
              this.callWechatPay(attachInfo);
              return ;
            }
            payUrl = `/qrcode/${payment.owner}/${payment.name}?providerName=${provider.name}&payUrl=${encodeURI(payment.payUrl)}&successUrl=${encodeURI(payment.successUrl)}`;
          }
          Setting.goToLink(payUrl);
        } else {
          Setting.showMessage("error", `${i18next.t("general:Failed to save")}: ${res.msg}`);
          this.setState({
            isPlacingOrder: false,
          });
        }
      })
      .catch(error => {
        Setting.showMessage("error", `${i18next.t("general:Failed to connect to server")}: ${error}`);
      });
  }

  getPayButton(provider) {
    let text = provider.type;
    if (provider.type === "Dummy") {
      text = i18next.t("product:Dummy");
    } else if (provider.type === "Alipay") {
      text = i18next.t("product:Alipay");
    } else if (provider.type === "WeChat Pay") {
      text = i18next.t("product:WeChat Pay");
    } else if (provider.type === "PayPal") {
      text = i18next.t("product:PayPal");
    } else if (provider.type === "Stripe") {
      text = i18next.t("product:Stripe");
    }

    return (
      <Button className="payment-provider-button" style={{height: "50px", borderWidth: "2px"}} shape="round" icon={
        <img style={{marginRight: "10px"}} width={36} height={36} src={Setting.getProviderLogoURL(provider)} alt={provider.displayName} />
      } size={"large"} >
        {
          text
        }
      </Button>
    );
  }

  renderProviderButton(provider, product) {
    return (
      <span key={provider.name} style={{width: "200px", marginRight: "20px", marginBottom: "10px"}}>
        <span style={{width: "200px", cursor: "pointer"}} onClick={() => this.buyProduct(product, provider)}>
          {
            this.getPayButton(provider)
          }
        </span>
      </span>
    );
  }

  renderPay(product) {
    if (product === undefined || product === null) {
      return null;
    }

    if (product.state !== "Published") {
      return i18next.t("product:This product is currently not in sale.");
    }
    if (product.providerObjs.length === 0) {
      return i18next.t("product:There is no payment channel for this product.");
    }

    return product.providerObjs.map(provider => {
      return this.renderProviderButton(provider, product);
    });
  }

  render() {
    const product = this.getProductObj();

    if (product === null) {
      return null;
    }

    return (
      <div className="login-content">
        <div dangerouslySetInnerHTML={{__html: formCssdefault}} />
        {Setting.inIframe() || Setting.isMobile() ? null : (
          <div dangerouslySetInnerHTML={{__html: this.state.product?.formCss ?? ""}} />
        )}
        <div className="product-box">
          <Spin spinning={this.state.isPlacingOrder} size="large" tip={i18next.t("product:Placing order...")} style={{paddingTop: "10%"}} >
            <Descriptions title={<span className="product-title">{i18next.t("product:Buy Product")}</span>} bordered className="product-descriptions">
              <Descriptions.Item label={i18next.t("general:Name")} span={3} className="product-item">
                <span className="product-name">
                  {Setting.getLanguageText(product?.displayName)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label={i18next.t("product:Detail")} className="product-item">
                <span className="product-detail">{Setting.getLanguageText(product?.detail)}</span>
              </Descriptions.Item>
              <Descriptions.Item label={i18next.t("user:Tag")} className="product-item">
                <span className="product-tag">{product?.tag}</span>
              </Descriptions.Item>
              <Descriptions.Item label={i18next.t("product:SKU")} className="product-item">
                <span className="product-sku">{product?.name}</span>
              </Descriptions.Item>
              <Descriptions.Item label={i18next.t("product:Image")} span={3} className="product-item">
                <img className="product-image" src={product?.image} alt={product?.name} height={90} style={{marginBottom: "20px"}} />
              </Descriptions.Item>
              {
                product.isRecharge ? (
                  <Descriptions.Item span={3} label={i18next.t("product:Price")} className="product-item">
                    <Space className="product-price-input">
                      <InputNumber className="price-input" min={0} value={this.state.customPrice} onChange={(e) => {this.setState({customPrice: e});}} />
                      <span className="price-currency">{Setting.getCurrencyText(product)}</span>
                    </Space>
                  </Descriptions.Item>
                ) : (
                  <React.Fragment>
                    <Descriptions.Item label={i18next.t("product:Price")} className="product-item">
                      <span className="product-price">
                        {this.getPrice(product)}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label={i18next.t("product:Quantity")} className="product-item">
                      <span className="product-quantity">{product?.quantity}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label={i18next.t("product:Sold")} className="product-item">
                      <span className="product-sold">{product?.sold}</span>
                    </Descriptions.Item>
                  </React.Fragment>
                )
              }
              <Descriptions.Item label={i18next.t("product:Pay")} span={3} className="product-item">
                <div className="product-payment">
                  {this.renderPay(product)}
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Spin>
        </div>
      </div>
    );
  }
}

export default ProductBuyPage;
