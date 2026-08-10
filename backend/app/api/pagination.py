from fastapi import Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel


class PaginationParams(BaseModel):
    skip: int
    limit: int
    sort_by: str | None
    sort_order: str


def get_pagination_params(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    sort_by: str | None = Query(None, description="Field to sort by"),
    sort_order: str = Query("desc", description="Sort order: 'asc' or 'desc'")
) -> PaginationParams:
    return PaginationParams(
        skip=skip, 
        limit=limit, 
        sort_by=sort_by, 
        sort_order=sort_order
    )


async def get_total_count(db: AsyncSession, query) -> int:
    """Calculates the total count of a given SQLAlchemy query safely."""
    count_query = select(func.count()).select_from(query.order_by(None).subquery())
    result = await db.execute(count_query)
    return result.scalar_one()


def apply_pagination(query, skip: int, limit: int):
    """Applies offset and limit to the query."""
    return query.offset(skip).limit(limit)


def create_paginated_response(items: list, total: int, skip: int, limit: int) -> dict:
    """Builds the final dictionary matching the PaginatedResponse schema."""
    page = (skip // limit) + 1 if limit > 0 else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": limit
    }
