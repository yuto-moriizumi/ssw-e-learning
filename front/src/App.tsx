import React from "react";
import { Button, Container, Nav, Navbar, Table, Spinner, Form, Col } from "react-bootstrap";
import axios from "axios";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";

type State = {
  is_updating: boolean;
  products: Product[];
  is_adding: boolean;
};
interface Product {
  id: number;
  name: string;
  type: string;
  url_com: string;
  url_kakaku: string;
  price_com_num: number;
  price_kakaku_num: number;
  price_com: string;
  price_kakaku: string;
}
type ResponceOER = {
  rates: { JPY: number };
};
export default class App extends React.Component<{}, State> {
  state = { is_updating: false, products: new Array<Product>(), is_adding: false };
  private SERVER_HOST = process.env.REACT_APP_SERVER_URL || "SERVER_HOST";
  private OER_APP_ID = process.env.REACT_APP_OER_APP_ID || "OER_APP_ID";
  private exchange_rate = 0;

  componentDidMount() {
    this.update();
    this.getExchangeRate();
  }

  private async update() {
    this.setState({ is_updating: true });
    try {
      const res = await axios.get(`${this.SERVER_HOST}/products`);
      const products = (res.data as Product[]).map((product) => {
        product.price_com_num = this.USD2JPY(product.price_com);
        product.price_kakaku_num = this.parseJPY(product.price_kakaku);
        return product;
      });
      console.log(products);
      this.setState({
        products: products.sort((a, b) => {
          let a_diff = a.price_kakaku_num - a.price_com_num;
          if (isNaN(a_diff)) a_diff = -99999;
          let b_diff = b.price_kakaku_num - b.price_com_num;
          if (isNaN(b_diff)) b_diff = -99999;
          return b_diff - a_diff;
        }),
      });
    } catch (error) {
      console.log(error);
    }
    this.setState({ is_updating: false });
  }

  private putProduct(product: Product) {
    axios.put(`${this.SERVER_HOST}/products/${product.id}`, product);
  }

  //1$何円かを返す
  private async getExchangeRate() {
    const res = await axios.get(`https://openexchangerates.org/api/latest.json?app_id=${this.OER_APP_ID}`);
    const data = res.data as ResponceOER;
    const JPY = data.rates.JPY;
    this.exchange_rate = JPY;
  }

  private async delete(index: number) {
    const product = this.state.products[index];
    await axios.delete(`${this.SERVER_HOST}/products/${product.id}`);
    this.setState({
      products: this.state.products.filter((product2) => product !== product2),
    });
  }

  private USD2JPY(str: string) {
    return Math.round(parseFloat(str) * this.exchange_rate);
  }

  private parseJPY(str: string) {
    return parseInt(str);
  }

  render() {
    return (
      <>
        <Navbar bg="light" expand="sm">
          <Navbar.Brand>
            <h1>Amazon.com vs 価格.com</h1>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ml-auto"></Nav>
          </Navbar.Collapse>
        </Navbar>
        <Container className="text-center" fluid>
          <Button
            size="lg"
            className="my-4"
            disabled={this.state.is_updating}
            onClick={(e) => {
              this.update();
            }}
          >
            {this.state.is_updating ? <Spinner animation="border" /> : "更新"}
          </Button>
          <p>Amazon.comのURLを入れる際は、refパラメータを外すこと</p>
          <Table striped bordered hover size={"sm"}>
            <thead>
              <tr>
                <Col xs={2} as={"th"}>
                  商品名
                </Col>
                <Col xs={1} as={"th"}>
                  種類
                </Col>
                <Col xs={4} as={"th"}>
                  Amazon.com URL
                </Col>
                <Col xs={2} as={"th"}>
                  価格.com URL
                </Col>
                <Col xs={"auto"} as={"th"}>
                  Amazon.com 価格
                </Col>
                <Col xs={"auto"} as={"th"}>
                  価格.com 価格
                </Col>
                <Col xs={"auto"} as={"th"}>
                  差
                </Col>
                <Col xs={"auto"} as={"th"}>
                  削除
                </Col>
              </tr>
            </thead>
            <tbody>
              {this.state.products.map((product, index) => {
                const price_com = this.USD2JPY(product.price_com);
                const price_kakaku = this.parseJPY(product.price_kakaku);
                return (
                  <tr key={product.id}>
                    <td>
                      <Form.Control
                        value={product.name}
                        onChange={(e) => {
                          this.setState({
                            products: this.state.products.map((product2) => {
                              if (product2 === product) product2.name = e.target.value;
                              return product2;
                            }),
                          });
                          this.putProduct(product);
                        }}
                      />
                    </td>
                    <td>
                      <Form.Control
                        value={product.type}
                        onChange={(e) => {
                          this.setState({
                            products: this.state.products.map((product2) => {
                              if (product2 === product) product2.type = e.target.value;
                              return product2;
                            }),
                          });
                          this.putProduct(product);
                        }}
                      />
                    </td>
                    <td>
                      <Form.Control
                        value={product.url_com}
                        onChange={(e) => {
                          this.setState({
                            products: this.state.products.map((product2) => {
                              if (product2 === product) product2.url_com = e.target.value;
                              return product2;
                            }),
                          });
                          this.putProduct(product);
                        }}
                      />
                    </td>
                    <td>
                      <Form.Control
                        value={product.url_kakaku}
                        onChange={(e) => {
                          this.setState({
                            products: this.state.products.map((product2) => {
                              if (product2 === product) product2.url_kakaku = e.target.value;
                              return product2;
                            }),
                          });
                          this.putProduct(product);
                        }}
                      />
                    </td>
                    <td>
                      <p className="h4">{price_com.toString()}</p>
                    </td>
                    <td>
                      <p className="h4">{price_kakaku.toString()}</p>
                    </td>
                    <td>
                      <p className="h4">{(price_kakaku - price_com).toString()}</p>
                    </td>
                    <td>
                      <Button
                        onClick={() => {
                          this.delete(index);
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Button
            size="lg"
            className="my-4"
            disabled={this.state.is_adding}
            onClick={() => {
              const new_product = {
                name: "name",
                type: "type",
                url_com: "url_com",
                url_kakaku: "url_kakaku",
              };
              this.setState({ is_adding: true });
              axios
                .post(`${this.SERVER_HOST}/products`, new_product)
                .then((res) => {
                  const data = res.data as { id: number };
                  console.log(data);
                  this.setState({
                    products: this.state.products.concat([
                      {
                        id: data.id,
                        price_com: "NONE",
                        price_kakaku: "NONE",
                        price_com_num: -1,
                        price_kakaku_num: -1,
                        ...new_product,
                      },
                    ]),
                  });
                })
                .catch((e) => console.log(e))
                .finally(() => this.setState({ is_adding: false }));
            }}
          >
            {this.state.is_adding ? <Spinner animation="border" /> : <FontAwesomeIcon icon={faPlus} />}
          </Button>
        </Container>
      </>
    );
  }
}
