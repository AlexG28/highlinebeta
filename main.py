#!/usr/bin/env python3
"""
Simple script demonstrating a divide function.
The original error occurred because divide was called with a string
without converting it to an integer, leading to a TypeError.
This implementation safely converts the input to an integer before
performing the division.
"""

def divide(number):
    """Return 100 divided by *number*.

    The *number* argument can be an ``int`` or a string representing an
    integer.  If conversion fails, a ``ValueError`` is raised.
    """
    try:
        # Convert strings that represent integers to int
        num = int(number)
    except (TypeError, ValueError) as exc:
        raise ValueError("Invalid numeric input for divide") from exc
    return 100 / num

if __name__ == "__main__":
    # Simple CLI for manual testing
    inpt = input("Enter a number to divide 100 by: ")
    print(divide(inpt))
