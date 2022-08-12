import express from "express";
import mysql2 from "mysql2/promise";
import { JSDOM } from "jsdom";
import axios from "axios";
import dayjs from "dayjs";

const router = express.Router();

const CACHE_HOURS = 24;
const DB_SETTING = {
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DB_NAME,
};

interface Product {
  name: string;
  type: string;
  url_com: string;
  url_kakaku: string;
}

interface DbProduct extends Product {
  id: number;
  price_com: number;
  price_kakaku: number;
  cached_at: string;
}

// 製品を全て取得
router.get("/", async (req, res) => {
  const connection = await mysql2.createConnection(DB_SETTING);
  try {
    await connection.connect();
    const [result, fields] = await connection.query("SELECT * FROM products");
    const products = result as DbProduct[];

    //古い商品情報を更新

    const products2update: DbProduct[] = [];
    const latest_products: DbProduct[] = [];

    // キャッシュ日時から CACHE_HOURS 時間経過後であるならば更新の必要がある
    // この条件に基づき配列を分割
    for (const product of products) {
      if (dayjs().isAfter(dayjs(product.cached_at).add(CACHE_HOURS, "hours")))
        products2update.push(product);
      else latest_products.push(product);
    }

    const updated_products = await Promise.all(
      products2update.map(async (product) => {
        const price_com = await getAmazonPrice(product.url_com);
        if (!(price_com instanceof Error)) {
          product.price_com = price_com;
        }
        const price_kakaku = await getKakakuPrice(product.url_kakaku);
        if (!(price_kakaku instanceof Error)) {
          product.price_kakaku = price_kakaku;
        }
        if (!(price_com instanceof Error || price_kakaku instanceof Error)) {
          //どちらもエラーでなければキャッシュを更新
          await connection.execute(
            "UPDATE products SET price_com=?, price_kakaku=?, cached_at=NOW() WHERE id=?",
            [product.price_com, product.price_kakaku, product.id]
          );
        }
        return product;
      })
    );

    res.send(latest_products.concat(updated_products));
  } catch (error) {
    console.log(error);
    res.status(500).send();
  }
  connection.end();
});

//Aamazon.comの商品URLから価格を取得します $12.34 形式
async function getAmazonPrice(url: string) {
  try {
    const url_object = new URL(url);
    let data: any;

    //try 3 times
    for (let i = 0; i < 3; i++) {
      const res = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0",
        },
      });
      if (res.status.toString().startsWith("2")) {
        data = res.data;
        break;
      }
    }

    const document = new JSDOM(data).window.document;
    const body_txt = document.body.textContent;

    if (!body_txt) return Error("Body text content was null or undefined");
    const pricesWith$ = body_txt.match(/\$\d+[\d\.]+/g);

    // Array Structure
    // P = Price
    // T = Total
    // AGS = AmazonGlobal Shipping
    // EIFD = Estimated Import Fees Deposit
    // Actual Cost = P + AGS
    // [P, T, P, AGS, EIFD, T, ...]
    if (!pricesWith$) return Error("Prices was not found");
    // console.log(pricesWith$);
    const price = pricesWith$
      .slice(2, 4)
      .map((price) => {
        return parseFloat(price.slice(1));
      })
      .reduce((sum, element) => {
        return sum + element;
      }, 0);
    return price;
  } catch (error) {
    console.error(error);
    return Error("An unexpected error occured");
  }
}

//価格.comの商品URLから価格を取得します ￥10,000 形式
async function getKakakuPrice(url: string) {
  try {
    const url_object = new URL(url);
    const res = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:86.0) Gecko/20100101 Firefox/86.0",
      },
    });
    const document = new JSDOM(res.data).window.document;
    const price_elements = document.getElementsByClassName("priceTxt");
    if (price_elements.length === 0) return Error("Price text was not found");
    const price_str = price_elements[0].textContent;
    if (price_str == null) return Error("Price text was not found");
    const price = parseInt(price_str.replace(",", "").slice(1)); //円マークを切り落とし、,表記をなくす
    return price;
  } catch (error) {
    console.log(error);
    return Error("An unexpected error occured");
  }
}

// 商品を登録
router.post("/", async (req, res) => {
  // const id = req.params.id;
  const product = req.body as Product;
  const connection = await mysql2.createConnection(DB_SETTING);
  try {
    await connection.connect();
    await connection.execute(
      "INSERT IGNORE products VALUES (NULL, ?, ?, ?, ?, 0, 0, '1990-10-10')",
      [product.name, product.type, product.url_com, product.url_kakaku]
    );
    //自動採番を取得
    const [result, fields] = await connection.query(
      "SELECT LAST_INSERT_ID() AS LAST_INSERT_ID"
    );
    const id = result as { LAST_INSERT_ID: number }[];
    res.status(201).send({ id: id[0].LAST_INSERT_ID });
  } catch (error) {
    console.log(error);
    res.status(500).send();
  }
  connection.end();
});

// 商品を更新
router.put("/:id", async (req, res) => {
  const product = req.body as Product;
  const connection = await mysql2.createConnection(DB_SETTING);
  try {
    await connection.connect();
    await connection.execute(
      "UPDATE products SET name=?, type=?, url_com=?, url_kakaku=? WHERE id=?",
      [
        product.name,
        product.type,
        product.url_com,
        product.url_kakaku,
        req.params.id,
      ]
    );
    res.status(200).send();
  } catch (error) {
    console.log(error);
    res.status(500).send();
  }
  connection.end();
});

// 商品を削除
router.delete("/:id", async (req, res) => {
  const connection = await mysql2.createConnection(DB_SETTING);
  try {
    await connection.connect();
    await connection.execute("DELETE FROM products WHERE id=?", [
      req.params.id,
    ]);
    res.status(200).send();
  } catch (error) {
    console.log(error);
    res.status(500).send();
  }
  connection.end();
});

export default router;
