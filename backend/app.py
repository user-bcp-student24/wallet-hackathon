import os
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from flask import Flask, Response, jsonify, request


DEFAULT_W1_BASE_URL = "https://bcp-wallet-mock.yefri.workers.dev/groups/5"
DEFAULT_W1_KYC_URL = f"{DEFAULT_W1_BASE_URL}/kyc/verifications"


def forward_to_w1(upstream_request, timeout_seconds):
    try:
        upstream_response = urlopen(upstream_request, timeout=timeout_seconds)
    except HTTPError as error:
        upstream_response = error
    except (URLError, TimeoutError):
        return jsonify(error="KYC_UNAVAILABLE"), 503

    try:
        body = upstream_response.read()
        status = upstream_response.getcode()
        content_type = upstream_response.headers.get(
            "Content-Type", "application/json"
        )
    finally:
        upstream_response.close()

    return Response(body, status=status, content_type=content_type)


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.from_mapping(
        W1_BASE_URL=os.environ.get("W1_BASE_URL", DEFAULT_W1_BASE_URL),
        W1_KYC_URL=os.environ.get("W1_KYC_URL", DEFAULT_W1_KYC_URL),
        W1_TIMEOUT_SECONDS=10,
    )
    if test_config:
        app.config.update(test_config)

    @app.get("/health")
    def health():
        return jsonify(status="ok")

    @app.post("/crear-wallet")
    def crear_wallet():
        upstream_request = Request(
            app.config["W1_KYC_URL"],
            data=request.get_data(cache=False),
            headers={
                "Content-Type": request.headers.get(
                    "Content-Type", "application/json"
                ),
                "User-Agent": request.headers.get(
                    "User-Agent", "Wallet-Hackathon-Backend/1.0"
                ),
            },
            method="POST",
        )
        return forward_to_w1(upstream_request, app.config["W1_TIMEOUT_SECONDS"])

    @app.get("/consultar-kyc/<verification_id>")
    def consultar_kyc(verification_id):
        verification_url = (
            f"{app.config['W1_KYC_URL'].rstrip('/')}/"
            f"{quote(verification_id, safe='')}"
        )
        upstream_request = Request(
            verification_url,
            headers={
                "User-Agent": request.headers.get(
                    "User-Agent", "Wallet-Hackathon-Backend/1.0"
                )
            },
            method="GET",
        )
        return forward_to_w1(upstream_request, app.config["W1_TIMEOUT_SECONDS"])

    @app.post("/resolver-decision/<verification_id>")
    def resolver_decision(verification_id):
        decision_url = (
            f"{app.config['W1_KYC_URL'].rstrip('/')}/"
            f"{quote(verification_id, safe='')}/decision"
        )
        upstream_request = Request(
            decision_url,
            data=request.get_data(cache=False),
            headers={
                "Content-Type": request.headers.get(
                    "Content-Type", "application/json"
                ),
                "User-Agent": request.headers.get(
                    "User-Agent", "Wallet-Hackathon-Backend/1.0"
                ),
            },
            method="POST",
        )
        return forward_to_w1(upstream_request, app.config["W1_TIMEOUT_SECONDS"])

    @app.get("/consulta-estado-saldos/<wallet_id>")
    def consulta_estado_saldos(wallet_id):
        wallet_url = (
            f"{app.config['W1_BASE_URL'].rstrip('/')}/wallets/"
            f"{quote(wallet_id, safe='')}"
        )
        upstream_request = Request(
            wallet_url,
            headers={
                "User-Agent": request.headers.get(
                    "User-Agent", "Wallet-Hackathon-Backend/1.0"
                )
            },
            method="GET",
        )
        return forward_to_w1(upstream_request, app.config["W1_TIMEOUT_SECONDS"])

    return app


if __name__ == "__main__":
    create_app().run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
    )