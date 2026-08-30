module aegis_defi_demo::router {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    public struct SwapEvent has copy, drop {
        sender: address,
        amount_in: u64,
        amount_out: u64,
    }

    public fun swap_exact_input(coin: Coin<SUI>, ctx: &mut TxContext): Coin<SUI> {
        let amount_in = coin::value(&coin);
        let amount_out = amount_in; // 1:1 demo swap representation
        event::emit(SwapEvent {
            sender: tx_context::sender(ctx),
            amount_in,
            amount_out,
        });
        coin
    }
}

module aegis_defi_demo::pool {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    public struct PoolSwapEvent has copy, drop {
        sender: address,
        amount_in: u64,
    }

    public fun swap_exact_input(coin: Coin<SUI>, ctx: &mut TxContext): Coin<SUI> {
        let amount_in = coin::value(&coin);
        event::emit(PoolSwapEvent {
            sender: tx_context::sender(ctx),
            amount_in,
        });
        coin
    }
}

module aegis_defi_demo::lending {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    public struct CollateralEvent has copy, drop {
        sender: address,
        amount: u64,
    }

    public struct BorrowEvent has copy, drop {
        sender: address,
        amount: u64,
    }

    public fun deposit_collateral(coin: Coin<SUI>, ctx: &mut TxContext) {
        let amount = coin::value(&coin);
        event::emit(CollateralEvent {
            sender: tx_context::sender(ctx),
            amount,
        });
        // In demo, refund collateral back to sender to keep funds safe
        sui::transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    public fun borrow(amount: u64, ctx: &mut TxContext): Coin<SUI> {
        event::emit(BorrowEvent {
            sender: tx_context::sender(ctx),
            amount,
        });
        // Mint temporary SUI coin representation for chaining
        coin::zero<SUI>(ctx)
    }
}

module aegis_defi_demo::farm {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;

    public struct StakeEvent has copy, drop {
        sender: address,
        amount: u64,
    }

    public fun stake(coin: Coin<SUI>, ctx: &mut TxContext) {
        let amount = coin::value(&coin);
        event::emit(StakeEvent {
            sender: tx_context::sender(ctx),
            amount,
        });
        sui::transfer::public_transfer(coin, tx_context::sender(ctx));
    }
}

module aegis_defi_demo::rewards {
    use sui::event;

    public struct AirdropClaimEvent has copy, drop {
        claimer: address,
    }

    public fun claim_airdrop(ctx: &mut TxContext) {
        event::emit(AirdropClaimEvent {
            claimer: tx_context::sender(ctx),
        });
    }
}

module aegis_defi_demo::vault {
    public struct OwnerCap has key, store {
        id: sui::object::UID,
    }

    public fun create_owner_cap(ctx: &mut TxContext): OwnerCap {
        OwnerCap {
            id: sui::object::new(ctx),
        }
    }

    public fun delete_owner_cap(cap: OwnerCap) {
        let OwnerCap { id } = cap;
        sui::object::delete(id);
    }
}
