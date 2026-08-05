import Capacitor
import Foundation
import StoreKit

/// App Store のアプリ内課金（StoreKit 2）。
/// 扱うのは非消耗型が2つだけ。
///   app.tuzukin.diet.trial7 … ¥0 の体験用（App Store の規約 3.1.1 が求める形）
///   app.tuzukin.diet.full   … フルアクセスの買い切り
@objc(PurchasePlugin)
public class PurchasePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PurchasePlugin"
    public let jsName = "Purchase"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "owned", returnType: CAPPluginReturnPromise)
    ]

    private var updatesTask: Task<Void, Never>?

    override public func load() {
        // アプリの外で承認された購入（承認待ち・別端末での購入）を取りこぼさない
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                guard case .verified(let transaction) = update else { continue }
                await transaction.finish()
                self?.notifyListeners("purchasesUpdated", data: [:])
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        let ids = call.getArray("ids", String.self) ?? []
        guard !ids.isEmpty else {
            call.resolve(["products": [] as [JSObject]])
            return
        }
        Task {
            do {
                let products = try await Product.products(for: ids)
                let list: [JSObject] = products.map { product in
                    ["id": product.id, "price": product.displayPrice]
                }
                call.resolve(["products": list])
            } catch {
                // 取れなくても致命ではない。呼び出し側が既定の表示に落とす。
                call.resolve(["products": [] as [JSObject]])
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else {
            call.reject("商品IDが指定されていません")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.resolve(["status": "failed"])
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    if case .verified(let transaction) = verification {
                        await transaction.finish()
                        call.resolve(["status": "purchased"])
                    } else {
                        call.resolve(["status": "failed"])
                    }
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    // 承認待ち（ファミリー共有の購入承認など）
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.resolve(["status": "failed"])
                }
            } catch {
                call.resolve(["status": "failed"])
            }
        }
    }

    @objc func owned(_ call: CAPPluginCall) {
        Task {
            call.resolve(["owned": await currentOwned()])
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            // 明示的な復元。失敗しても手元の権利は currentEntitlements で確認できる。
            try? await AppStore.sync()
            call.resolve(["owned": await currentOwned()])
        }
    }

    /// 現在この Apple ID が持っている非消耗型を返す。
    /// purchasedAt を返すのは、体験の開始日をストア側の事実に合わせるため
    /// （再インストールで体験期間がリセットされないようにする）。
    private func currentOwned() async -> [JSObject] {
        var result: [JSObject] = []
        for await entitlement in Transaction.currentEntitlements {
            guard case .verified(let transaction) = entitlement else { continue }
            if transaction.revocationDate != nil { continue }
            result.append([
                "id": transaction.productID,
                "purchasedAt": transaction.purchaseDate.timeIntervalSince1970 * 1000
            ])
        }
        return result
    }
}
