"""Pydantic argument schemas for EVERY tool action. Unknown fields rejected."""
import re
from pydantic import BaseModel, Field, field_validator


class StrictModel(BaseModel):
    model_config = {"extra": "forbid"}


# ---- email ----
class EmailListArgs(StrictModel):
    limit: int = Field(default=10, ge=1, le=50)


class EmailReadArgs(StrictModel):
    email_id: int = Field(ge=1)


class EmailSearchArgs(StrictModel):
    query: str = Field(min_length=1, max_length=200)


class EmailDraftArgs(StrictModel):
    to: str = Field(min_length=3, max_length=200)
    subject: str = Field(default="(no subject)", max_length=300)
    body: str = Field(default="", max_length=5000)
    classification: str = Field(default="INTERNAL", pattern="^(PUBLIC|INTERNAL|CONFIDENTIAL|RESTRICTED)$")


class EmailSendArgs(StrictModel):
    to: str = Field(min_length=3, max_length=200)
    subject: str = Field(default="(no subject)", max_length=300)
    body: str = Field(default="", max_length=5000)
    classification: str = Field(default="INTERNAL", pattern="^(PUBLIC|INTERNAL|CONFIDENTIAL|RESTRICTED)$")

    @field_validator("to")
    @classmethod
    def synthetic_recipient(cls, v):
        v = v.strip().lower()
        allowed = ("@nexacorp.example", "@example.com", "@example.org", "@example.net")
        if not any(v.endswith(a) for a in allowed):
            raise ValueError("Recipient must be a synthetic address (@nexacorp.example / @example.com)")
        return v


# ---- browser ----
class BrowserSearchArgs(StrictModel):
    query: str = Field(min_length=1, max_length=200)


class BrowserReadArgs(StrictModel):
    url: str = Field(min_length=4, max_length=300)

    @field_validator("url")
    @classmethod
    def internal_only(cls, v):
        v = v.strip()
        if not re.match(r"^(https?://)?([a-z0-9-]+\.)*nexacorp\.example(/|$)", v.lower()):
            raise ValueError("Only synthetic internal pages (*.nexacorp.example) may be browsed; external URLs are rejected")
        return v


# ---- files ----
class FilesListArgs(StrictModel):
    limit: int = Field(default=20, ge=1, le=50)


class FilesSearchArgs(StrictModel):
    query: str = Field(min_length=1, max_length=200)


class FilesReadArgs(StrictModel):
    name: str = Field(min_length=1, max_length=200)


class FilesCreateArgs(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    content: str = Field(default="", max_length=20000)
    classification: str = Field(default="INTERNAL", pattern="^(PUBLIC|INTERNAL|CONFIDENTIAL|RESTRICTED)$")


# ---- payments ----
class PaymentViewArgs(StrictModel):
    invoice: str | None = Field(default=None, max_length=60)


class PaymentValidateArgs(StrictModel):
    invoice: str = Field(min_length=3, max_length=60)


class PaymentExecuteArgs(StrictModel):
    invoice: str = Field(min_length=3, max_length=60)


ARG_SCHEMAS = {
    "EmailListArgs": EmailListArgs, "EmailReadArgs": EmailReadArgs, "EmailSearchArgs": EmailSearchArgs,
    "EmailDraftArgs": EmailDraftArgs, "EmailSendArgs": EmailSendArgs,
    "BrowserSearchArgs": BrowserSearchArgs, "BrowserReadArgs": BrowserReadArgs,
    "FilesListArgs": FilesListArgs, "FilesSearchArgs": FilesSearchArgs, "FilesReadArgs": FilesReadArgs,
    "FilesCreateArgs": FilesCreateArgs,
    "PaymentViewArgs": PaymentViewArgs, "PaymentValidateArgs": PaymentValidateArgs,
    "PaymentExecuteArgs": PaymentExecuteArgs,
}
